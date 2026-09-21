package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/migrations"
)

// TestRunIntegration exercises the migration runner against a real PostgreSQL
// database. It is opt-in, following the same convention as the @repo/redis
// integration check:
//
//	NOTIFICATION_DB_TEST_URL="postgresql://..." go test ./internal/db/ -run Integration -v
//
// The migrations are idempotent, so this is safe to run repeatedly against a
// development database.
func TestRunIntegration(t *testing.T) {
	url := os.Getenv("NOTIFICATION_DB_TEST_URL")
	if url == "" {
		t.Skip("set NOTIFICATION_DB_TEST_URL to a live PostgreSQL database to run this test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect to database: %v", err)
	}
	defer pool.Close()

	migrationList, err := LoadMigrations(migrations.Files)
	if err != nil {
		t.Fatalf("load migrations: %v", err)
	}

	if _, err := Run(ctx, pool, migrationList); err != nil {
		t.Fatalf("first migration run failed: %v", err)
	}

	// A second run must apply nothing and report everything as already applied.
	second, err := Run(ctx, pool, migrationList)
	if err != nil {
		t.Fatalf("second migration run failed: %v", err)
	}
	if len(second.Applied) != 0 {
		t.Errorf("expected no migrations to be applied on the second run, got %v", second.Applied)
	}
	if len(second.AlreadyApplied) != len(migrationList) {
		t.Errorf("expected %d already-applied migrations, got %d", len(migrationList), len(second.AlreadyApplied))
	}

	// Every migration must be recorded with its checksum.
	rows, err := pool.Query(ctx, "SELECT version, checksum FROM schema_migrations")
	if err != nil {
		t.Fatalf("read schema_migrations: %v", err)
	}
	recorded := make(map[string]string)
	for rows.Next() {
		var version, sum string
		if err := rows.Scan(&version, &sum); err != nil {
			rows.Close()
			t.Fatalf("scan schema_migrations row: %v", err)
		}
		recorded[version] = sum
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		t.Fatalf("read schema_migrations: %v", err)
	}

	for _, migration := range migrationList {
		if recorded[migration.Version] != migration.Checksum {
			t.Errorf("migration %s not recorded with the expected checksum", migration.Identifier())
		}
	}

	// Editing an already-applied migration must be rejected.
	edited := make([]Migration, len(migrationList))
	copy(edited, migrationList)
	edited[0].SQL += "\n-- edited after apply"
	edited[0].Checksum = checksum([]byte(edited[0].SQL))

	if _, err := Run(ctx, pool, edited); err == nil {
		t.Error("expected an error when an applied migration is edited, got nil")
	}
}
