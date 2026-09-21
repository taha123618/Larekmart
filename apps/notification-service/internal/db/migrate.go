// Package db owns the PostgreSQL schema concerns of notification-service: it
// loads the SQL migrations embedded in the binary, applies the ones that are
// still pending, and records what ran in the schema_migrations table.
//
// Every migration is applied inside a single transaction guarded by a
// PostgreSQL advisory lock, so several replicas can boot at once without racing
// each other or leaving the schema half-applied.
package db

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

const (
	// migrationFileSuffix marks the forward migrations this runner applies.
	// "<version>_<name>.down.sql" files are kept for manual rollback only.
	migrationFileSuffix = ".up.sql"

	// migrationAdvisoryLockID serialises concurrent migration runs. The value is
	// arbitrary but must never change, and must stay unique across Larekmart
	// services; it is derived from this service's reserved port (8005).
	migrationAdvisoryLockID int64 = 8005
)

const createSchemaMigrationsTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(64)  PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    checksum   VARCHAR(64)  NOT NULL,
    applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)`

const insertSchemaMigration = `
INSERT INTO schema_migrations (version, name, checksum)
VALUES ($1, $2, $3)
ON CONFLICT (version) DO NOTHING`

// Migration is a single versioned SQL script.
type Migration struct {
	Version  string
	Name     string
	SQL      string
	Checksum string
}

// Identifier is the "<version>_<name>" label used in logs and in
// schema_migrations.version / .name.
func (m Migration) Identifier() string {
	return m.Version + "_" + m.Name
}

// Result reports what a Run did.
type Result struct {
	// Applied holds the identifiers recorded by this run, in order.
	Applied []string
	// AlreadyApplied holds the identifiers that were recorded by an earlier run.
	AlreadyApplied []string
}

// Querier is the subset of *pgxpool.Pool that Run needs.
type Querier interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// appliedMigration is the recorded state of one applied migration.
type appliedMigration struct {
	Name     string
	Checksum string
}

// LoadMigrations reads every "<version>_<name>.up.sql" file in fsys and returns
// them ordered oldest-version-first. Down migrations and unrelated files are
// ignored; an invalid filename, a duplicate version, or an empty script is an
// error so a broken migration cannot reach the database.
func LoadMigrations(fsys fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("read migrations directory: %w", err)
	}

	migrations := make([]Migration, 0, len(entries))
	filenames := make(map[string]string, len(entries))

	for _, entry := range entries {
		filename := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(filename, migrationFileSuffix) {
			continue
		}

		version, name, err := parseMigrationFilename(filename)
		if err != nil {
			return nil, err
		}
		if previous, ok := filenames[version]; ok {
			return nil, fmt.Errorf("duplicate migration version %q in %q and %q", version, previous, filename)
		}
		filenames[version] = filename

		content, err := fs.ReadFile(fsys, filename)
		if err != nil {
			return nil, fmt.Errorf("read migration %q: %w", filename, err)
		}
		if len(bytes.TrimSpace(content)) == 0 {
			return nil, fmt.Errorf("migration %q is empty", filename)
		}

		migrations = append(migrations, Migration{
			Version:  version,
			Name:     name,
			SQL:      string(content),
			Checksum: checksum(content),
		})
	}

	if len(migrations) == 0 {
		return nil, fmt.Errorf("no *%s migrations found", migrationFileSuffix)
	}

	sort.Slice(migrations, func(i, j int) bool {
		left, _ := strconv.Atoi(migrations[i].Version)
		right, _ := strconv.Atoi(migrations[j].Version)
		if left != right {
			return left < right
		}
		return migrations[i].Name < migrations[j].Name
	})

	return migrations, nil
}

// parseMigrationFilename splits "<version>_<name>.up.sql" into its version and
// name, rejecting anything that does not follow the convention.
func parseMigrationFilename(filename string) (string, string, error) {
	base := strings.TrimSuffix(filename, migrationFileSuffix)
	version, name, found := strings.Cut(base, "_")
	if !found || version == "" || name == "" {
		return "", "", fmt.Errorf("invalid migration filename %q: expected <version>_<name>%s", filename, migrationFileSuffix)
	}
	if _, err := strconv.Atoi(version); err != nil {
		return "", "", fmt.Errorf("invalid migration filename %q: version %q must be numeric", filename, version)
	}
	return version, name, nil
}

// plan splits all migrations into the pending ones and the ones already applied,
// and fails when an applied migration was edited afterwards.
func plan(all []Migration, applied map[string]appliedMigration) (pending []Migration, alreadyApplied []string, err error) {
	for _, migration := range all {
		record, ok := applied[migration.Version]
		if !ok {
			pending = append(pending, migration)
			continue
		}
		if record.Checksum != migration.Checksum {
			return nil, nil, fmt.Errorf(
				"migration %s was already applied but its contents changed (recorded %s, current %s); add a new migration instead of editing an applied one",
				migration.Identifier(), record.Checksum, migration.Checksum,
			)
		}
		alreadyApplied = append(alreadyApplied, migration.Identifier())
	}
	return pending, alreadyApplied, nil
}

// Run applies every pending migration and records it in schema_migrations.
// It is safe to call on every startup and against a database that was migrated
// before the tracking table existed, because no-op migrations simply re-run and
// are then recorded.
func Run(ctx context.Context, pool Querier, migrations []Migration) (Result, error) {
	result := Result{}
	if len(migrations) == 0 {
		return result, nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return result, fmt.Errorf("begin migration transaction: %w", err)
	}
	// Rollback after a successful Commit is a no-op, so this only unwinds
	// failures.
	defer func() { _ = tx.Rollback(ctx) }()

	// Hold the lock for the whole transaction so concurrent replicas apply
	// migrations one at a time.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", migrationAdvisoryLockID); err != nil {
		return result, fmt.Errorf("acquire migration lock: %w", err)
	}

	if _, err := tx.Exec(ctx, createSchemaMigrationsTable); err != nil {
		return result, fmt.Errorf("create schema_migrations table: %w", err)
	}

	applied, err := appliedMigrations(ctx, tx)
	if err != nil {
		return result, err
	}

	pending, alreadyApplied, err := plan(migrations, applied)
	if err != nil {
		return result, err
	}
	result.AlreadyApplied = alreadyApplied

	for _, migration := range pending {
		if err := applyMigration(ctx, tx, migration); err != nil {
			return result, err
		}
		result.Applied = append(result.Applied, migration.Identifier())
	}

	if err := tx.Commit(ctx); err != nil {
		return result, fmt.Errorf("commit migrations: %w", err)
	}

	return result, nil
}

// appliedMigrations reads the current schema_migrations state.
func appliedMigrations(ctx context.Context, tx pgx.Tx) (map[string]appliedMigration, error) {
	rows, err := tx.Query(ctx, "SELECT version, name, checksum FROM schema_migrations")
	if err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]appliedMigration)
	for rows.Next() {
		var version string
		var record appliedMigration
		if err := rows.Scan(&version, &record.Name, &record.Checksum); err != nil {
			return nil, fmt.Errorf("scan schema_migrations row: %w", err)
		}
		applied[version] = record
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}

	return applied, nil
}

// applyMigration runs one script and records it, inside the caller's
// transaction.
func applyMigration(ctx context.Context, tx pgx.Tx, migration Migration) error {
	if _, err := tx.Exec(ctx, migration.SQL); err != nil {
		return fmt.Errorf("apply migration %s: %w", migration.Identifier(), err)
	}
	if _, err := tx.Exec(ctx, insertSchemaMigration, migration.Version, migration.Name, migration.Checksum); err != nil {
		return fmt.Errorf("record migration %s: %w", migration.Identifier(), err)
	}
	return nil
}

// checksum fingerprints a migration so edits to already-applied scripts can be
// detected.
func checksum(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}
