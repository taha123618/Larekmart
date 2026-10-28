package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/channels/email"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/channels/inapp"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/channels/push"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/channels/sms"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/config"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/consumers"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/db"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/handlers"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/templates"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/websocket"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/workers"
	"github.com/taha123618/Larekmart/apps/notification-service/migrations"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

func main() {
	// 1. Load Configuration
	cfg := config.LoadFromEnv()

	// 2. Structured Logger
	logger := observability.NewLogger(cfg.OTELServiceName, cfg.AppEnv, cfg.LogLevel, cfg.LogFormat)
	ctx := context.Background()
	logger.Info(ctx, fmt.Sprintf("Starting %s on port :%s (env: %s)", cfg.OTELServiceName, cfg.HTTPPort, cfg.AppEnv))

	// 3. OpenTelemetry Tracer Provider
	_, traceCleanup, err := observability.InitTracer(ctx, cfg.OTELServiceName, cfg.OTELExporterOTLPEndpoint, cfg.OTELEnabled)
	if err != nil {
		logger.Warn(ctx, "Failed to initialize OpenTelemetry tracer", map[string]interface{}{"error": err.Error()})
	}
	defer func() { _ = traceCleanup(context.Background()) }()

	// 4. Prometheus Metrics Registry
	metrics := observability.NewMetrics("notification_service")

	// 5. PostgreSQL Connection Pool
	pgxConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal(ctx, "Invalid DATABASE_URL configuration", err)
	}
	pgxConfig.MaxConns = int32(cfg.DBMaxOpenConns)
	pgxConfig.MinConns = int32(cfg.DBMaxIdleConns)
	pgxConfig.MaxConnLifetime = cfg.DBConnMaxLifetime

	dbPool, err := pgxpool.NewWithConfig(ctx, pgxConfig)
	if err != nil {
		logger.Fatal(ctx, "Failed to connect to PostgreSQL database", err)
	}
	defer dbPool.Close()

	if pingErr := dbPool.Ping(ctx); pingErr != nil {
		logger.Warn(ctx, "Initial PostgreSQL ping failed (will retry on demand)", map[string]interface{}{"error": pingErr.Error()})
	} else {
		logger.Info(ctx, "PostgreSQL database connection pool established")
	}

	// 5b. Database Schema Migrations
	// The migrations ship inside the binary; every pending script is applied and
	// recorded in schema_migrations before the repositories touch the schema.
	migrationList, loadErr := db.LoadMigrations(migrations.Files)
	if loadErr != nil {
		logger.Fatal(ctx, "Failed to load embedded database migrations", loadErr)
	}

	migrationResult, migrateErr := db.Run(ctx, dbPool, migrationList)
	if migrateErr != nil {
		// Tolerated so the service can still boot ahead of PostgreSQL, matching the
		// pool behaviour above; the next startup retries.
		logger.Warn(ctx, "Database migrations did not complete", map[string]interface{}{"error": migrateErr.Error()})
	} else {
		logger.Info(ctx, "Database schema is up to date", map[string]interface{}{
			"applied":         migrationResult.Applied,
			"already_applied": len(migrationResult.AlreadyApplied),
		})
	}

	// 6. Redis Client
	var redisClient *redis.Client
	if cfg.RedisURL != "" {
		opt, err := redis.ParseURL(cfg.RedisURL)
		if err == nil {
			redisClient = redis.NewClient(opt)
			defer redisClient.Close()
			if rPingErr := redisClient.Ping(ctx).Err(); rPingErr == nil {
				logger.Info(ctx, "Redis connection established for fast deduplication")
			} else {
				logger.Warn(ctx, "Redis ping failed, deduplication will fallback to database", map[string]interface{}{"error": rPingErr.Error()})
			}
		}
	}

	// 7. Repositories
	notificationRepo := repositories.NewNotificationRepository(dbPool)
	preferenceRepo := repositories.NewPreferenceRepository(dbPool)
	templateRepo := repositories.NewTemplateRepository(dbPool)
	deviceRepo := repositories.NewDeviceRepository(dbPool)
	eventRepo := repositories.NewEventRepository(dbPool, redisClient, cfg.RedisKeyPrefix, cfg.IdempotencyTTL)

	// 8. Template Engine
	templateEngine := templates.NewEngine()

	// 9. WebSocket Hub for in-app real-time notifications
	wsHub := websocket.NewHub(logger, metrics)
	wsCtx, wsCancel := context.WithCancel(ctx)
	defer wsCancel()
	go wsHub.Run(wsCtx)

	// 10. Channel Implementations
	emailChan := email.NewEmailChannel(cfg.KafkaBrokers, "email.dispatch", cfg.EmailServiceEnabled, logger)
	defer func() { _ = emailChan.Close() }()

	var smsProvider sms.Provider
	smsSender := cfg.SMSSenderNumber
	if cfg.SMSProvider == "twilio" || (cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "") {
		if smsSender == "" || smsSender == "+1234567890" {
			if cfg.TwilioPhoneNumber != "" {
				smsSender = cfg.TwilioPhoneNumber
			}
		}
		smsProvider = sms.NewTwilioProvider(cfg.TwilioAccountSID, cfg.TwilioAuthToken, smsSender, logger)
		logger.Info(ctx, "Twilio SMS provider initialized", map[string]interface{}{"from": smsSender})
	} else {
		smsProvider = sms.NewMockProvider(logger)
		logger.Info(ctx, "Mock SMS provider initialized")
	}
	smsChan := sms.NewSMSChannel(smsProvider, smsSender, logger)

	pushProvider := push.NewMockProvider(logger)
	pushChan := push.NewPushChannel(pushProvider, deviceRepo, logger)

	inappChan := inapp.NewInAppChannel(wsHub, logger)

	// 11. Worker Pools & Dispatcher
	dispatcher := workers.NewDispatcher(cfg.WorkerMaxRetries, logger)

	initialBackoff := time.Duration(cfg.WorkerInitialBackoffMS) * time.Millisecond
	dispatcher.RegisterPool(models.ChannelEmail, workers.NewChannelWorkerPool(
		models.ChannelEmail, emailChan, cfg.WorkerConcurrencyEmail, 500, initialBackoff, notificationRepo, logger, metrics,
	))
	dispatcher.RegisterPool(models.ChannelSMS, workers.NewChannelWorkerPool(
		models.ChannelSMS, smsChan, cfg.WorkerConcurrencySMS, 500, initialBackoff, notificationRepo, logger, metrics,
	))
	dispatcher.RegisterPool(models.ChannelPush, workers.NewChannelWorkerPool(
		models.ChannelPush, pushChan, cfg.WorkerConcurrencyPush, 500, initialBackoff, notificationRepo, logger, metrics,
	))
	dispatcher.RegisterPool(models.ChannelInApp, workers.NewChannelWorkerPool(
		models.ChannelInApp, inappChan, cfg.WorkerConcurrencyInApp, 1000, initialBackoff, notificationRepo, logger, metrics,
	))

	dispatcher.StartAll()
	defer dispatcher.StopAll()

	// 12. Business Services
	preferenceSvc := services.NewPreferenceService(preferenceRepo)
	templateSvc := services.NewTemplateService(templateRepo, templateEngine)
	deliverySvc := services.NewDeliveryService(dispatcher)
	notificationSvc := services.NewNotificationService(notificationRepo, preferenceSvc, templateSvc, deliverySvc, logger, metrics)

	// 13. Kafka Consumers & Domain Events
	domainEventHandler := consumers.NewDomainEventHandler(notificationSvc, templateSvc, eventRepo, logger, metrics)
	domainEventHandler.SetWebSocketHub(wsHub)
	consumerManager := consumers.NewConsumerManager(cfg.KafkaBrokers, cfg.KafkaGroupID, cfg.KafkaConsumerTopics, domainEventHandler, logger)
	consumerManager.Start(ctx)
	defer func() { _ = consumerManager.Close() }()

	// 14. HTTP Handlers & Chi Router
	notificationHandler := handlers.NewNotificationHandler(notificationSvc, deviceRepo)
	preferencesHandler := handlers.NewPreferencesHandler(preferenceSvc)
	templatesHandler := handlers.NewTemplatesHandler(templateSvc)

	r := chi.NewRouter()

	// Base Middleware
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.RequestLogger(logger))
	r.Use(middleware.Recoverer(logger))
	r.Use(middleware.SetupCORS(cfg.WebSocketAllowedOrigins))
	r.Use(middleware.OTelTracing(cfg.OTELServiceName))

	// Public Health & Observability Endpoints
	r.Get("/health", handlers.HealthHandler(dbPool, redisClient))
	r.Get("/ready", handlers.ReadyHandler(dbPool))
	r.Handle("/metrics", promhttp.Handler())

	// WebSocket In-App Endpoint
	r.Get("/ws", websocket.ServeWS(wsHub, logger))

	// Notification & Preference Routes
	r.Route("/notifications", func(nr chi.Router) {
		nr.Use(middleware.RequireAuth())

		nr.Get("/", notificationHandler.GetNotifications)
		nr.Get("/unread", notificationHandler.GetUnreadNotifications)
		nr.Patch("/{id}/read", notificationHandler.MarkAsRead)
		nr.Patch("/read-all", notificationHandler.MarkAllAsRead)
		nr.Post("/devices", notificationHandler.RegisterDevice)

		nr.Get("/preferences", preferencesHandler.GetPreferences)
		nr.Put("/preferences", preferencesHandler.UpdatePreferences)
		nr.Get("/templates", templatesHandler.ListTemplates)
	})

	// 15. HTTP Server Lifecycle
	srv := &http.Server{
		Addr:         ":" + cfg.HTTPPort,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info(ctx, fmt.Sprintf("HTTP Server listening on http://localhost:%s", cfg.HTTPPort))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal(ctx, "HTTP server failed to bind/listen", err)
		}
	}()

	// 16. Graceful Shutdown on OS Signals
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	sig := <-stopChan
	logger.Info(ctx, fmt.Sprintf("Received shutdown signal (%s), terminating gracefully...", sig.String()))

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error(ctx, "HTTP server forced shutdown error", err)
	}

	logger.Info(ctx, "Notification service shutdown complete")
}
