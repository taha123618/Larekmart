// Package migrations ships the notification-service SQL migrations inside the
// binary so the migration runner works regardless of the working directory.
//
// Add new schema changes as "<version>_<name>.up.sql" (with a matching
// "<version>_<name>.down.sql" for rollback documentation). Files are applied in
// version order and recorded in the schema_migrations table.
package migrations

import "embed"

// Files holds every "<version>_<name>.up.sql" script in this directory.
// Down migrations are intentionally excluded; they are kept for manual rollback.
//
//go:embed *.up.sql
var Files embed.FS
