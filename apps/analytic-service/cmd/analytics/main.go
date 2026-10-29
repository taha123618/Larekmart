package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/cache"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/config"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/db"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/handlers"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/ingestion"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/metrics"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

var log = observability.NewLogger("analytic-service")

func main() {
	cfg := config.Load()

	log.Info("Starting Larekmart Analytic Service (Go)", map[string]interface{}{
		"port":      cfg.Port,
		"env":       cfg.AppEnv,
		"batchSize": cfg.BatchSize,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize PostgreSQL Connection Pool
	dbInitCtx, dbCancel := context.WithTimeout(ctx, 5*time.Second)
	database, err := db.New(dbInitCtx, cfg.DatabaseURL)
	dbCancel()
	if err != nil {
		log.Warn("PostgreSQL connection failed; running in resilient in-memory mode", map[string]interface{}{
			"error": err.Error(),
		})
	} else {
		defer database.Close()
	}

	// 2. Initialize Redis Client
	redisClient := cache.New(cfg.RedisURL, cfg.RedisKeyPrefix)
	defer redisClient.Close()

	// 3. Initialize In-Memory Metrics Store
	store := metrics.NewStore()

	// 4. Initialize & Start Ingestion Batcher
	batcher := ingestion.NewBatcher(database, cfg.BatchSize, cfg.FlushInterval, cfg.QueueCapacity)
	batcher.Start()
	defer batcher.Stop()

	// 5. Initialize & Start Kafka Consumer Ingestion Loop
	consumer := ingestion.NewKafkaConsumer(cfg.KafkaBrokers, cfg.KafkaGroupID, store, batcher)
	consumer.Start(ctx)
	defer func() {
		_ = consumer.Close()
	}()

	// 6. Assemble Chi HTTP Router
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.SetupCORS([]string{cfg.ClientURL, cfg.AdminURL}))
	r.Use(middleware.RequestLogger)
	r.Use(chimw.Recoverer)

	// Health & Metrics Endpoints
	healthHandler := handlers.NewHealthHandler(database, redisClient)
	r.Get("/health", healthHandler.Check)
	r.Get("/health/live", healthHandler.Live)
	r.Get("/health/ready", healthHandler.Ready)
	r.Handle("/metrics", promhttp.Handler())

	// Analytics Admin API Endpoints
	analyticsHandler := handlers.NewAnalyticsHandler(database, redisClient, store, cfg.ChartCacheTTL, cfg.EventsCacheTTL)
	r.Route("/analytics", func(r chi.Router) {
		r.Use(middleware.RequireAdmin())

		r.Get("/summary", analyticsHandler.GetSummary)
		r.Get("/merchants", analyticsHandler.GetMerchants)
		r.Get("/daily-chart", analyticsHandler.GetDailyChart)
		r.Get("/events", analyticsHandler.GetRecentEvents)
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 7. Start HTTP Server in background goroutine
	go func() {
		log.Info(fmt.Sprintf("HTTP Server listening on port %s", cfg.Port))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("HTTP Server failed to listen", map[string]interface{}{"error": err.Error()})
			os.Exit(1)
		}
	}()

	// 8. Graceful Shutdown Signal Trapping
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	log.Info(fmt.Sprintf("Received shutdown signal (%s), terminating gracefully...", sig))

	// Stop accepting new HTTP requests
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error("HTTP Server forced to shutdown", map[string]interface{}{"error": err.Error()})
	}

	log.Info("Analytic service shutdown complete")
}
