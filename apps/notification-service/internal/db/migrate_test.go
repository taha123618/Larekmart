package db

import (
	"strings"
	"testing"
	"testing/fstest"

	"github.com/taha123618/Larekmart/apps/notification-service/migrations"
)

func TestLoadMigrations_OrdersByVersionAndIgnoresOtherFiles(t *testing.T) {
	fsys := fstest.MapFS{
		"000002_add_index.up.sql":     {Data: []byte("CREATE INDEX IF NOT EXISTS idx ON notifications (id);")},
		"000001_init_schema.up.sql":   {Data: []byte("CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(64));")},
		"000001_init_schema.down.sql": {Data: []byte("DROP TABLE notifications;")},
		"README.md":                   {Data: []byte("migration notes")},
	}

	got, err := LoadMigrations(fsys)
	if err != nil {
		t.Fatalf("expected migrations to load, got error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 migrations, got %d", len(got))
	}
	if got[0].Identifier() != "000001_init_schema" {
		t.Errorf("expected 000001_init_schema first, got %s", got[0].Identifier())
	}
	if got[1].Identifier() != "000002_add_index" {
		t.Errorf("expected 000002_add_index second, got %s", got[1].Identifier())
	}
	for _, migration := range got {
		if migration.Checksum == "" {
			t.Errorf("expected a checksum for %s", migration.Identifier())
		}
	}
	if got[0].Checksum == got[1].Checksum {
		t.Error("expected different checksums for different migration contents")
	}
}

func TestLoadMigrations_SortsNumericallyNotLexicographically(t *testing.T) {
	fsys := fstest.MapFS{
		"10_tenth.up.sql":    {Data: []byte("SELECT 10;")},
		"9_ninth.up.sql":     {Data: []byte("SELECT 9;")},
		"100_hundred.up.sql": {Data: []byte("SELECT 100;")},
	}

	got, err := LoadMigrations(fsys)
	if err != nil {
		t.Fatalf("expected migrations to load, got error: %v", err)
	}

	want := []string{"9_ninth", "10_tenth", "100_hundred"}
	for i, expected := range want {
		if got[i].Identifier() != expected {
			t.Errorf("position %d: expected %s, got %s", i, expected, got[i].Identifier())
		}
	}
}

func TestLoadMigrations_RejectsBrokenFiles(t *testing.T) {
	tests := []struct {
		name        string
		files       fstest.MapFS
		wantMessage string
	}{
		{
			name:        "missing version prefix",
			files:       fstest.MapFS{"init_schema.up.sql": {Data: []byte("SELECT 1;")}},
			wantMessage: "invalid migration filename",
		},
		{
			name:        "non-numeric version",
			files:       fstest.MapFS{"abc_init_schema.up.sql": {Data: []byte("SELECT 1;")}},
			wantMessage: "must be numeric",
		},
		{
			name: "duplicate version",
			files: fstest.MapFS{
				"000001_init_schema.up.sql": {Data: []byte("SELECT 1;")},
				"000001_other.up.sql":       {Data: []byte("SELECT 2;")},
			},
			wantMessage: "duplicate migration version",
		},
		{
			name:        "empty script",
			files:       fstest.MapFS{"000001_empty.up.sql": {Data: []byte("  \n\t")}},
			wantMessage: "is empty",
		},
		{
			name:        "no up migrations",
			files:       fstest.MapFS{"README.md": {Data: []byte("notes")}},
			wantMessage: "no *.up.sql migrations found",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := LoadMigrations(test.files)
			if err == nil {
				t.Fatalf("expected an error containing %q, got nil", test.wantMessage)
			}
			if !strings.Contains(err.Error(), test.wantMessage) {
				t.Errorf("expected error containing %q, got %q", test.wantMessage, err.Error())
			}
		})
	}
}

func TestPlan(t *testing.T) {
	all := []Migration{
		{Version: "000001", Name: "init_schema", Checksum: "checksum-one"},
		{Version: "000002", Name: "add_index", Checksum: "checksum-two"},
	}

	t.Run("nothing applied yet", func(t *testing.T) {
		pending, alreadyApplied, err := plan(all, map[string]appliedMigration{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(pending) != 2 {
			t.Errorf("expected 2 pending migrations, got %d", len(pending))
		}
		if len(alreadyApplied) != 0 {
			t.Errorf("expected no already-applied migrations, got %v", alreadyApplied)
		}
	})

	t.Run("first migration already applied", func(t *testing.T) {
		applied := map[string]appliedMigration{
			"000001": {Name: "init_schema", Checksum: "checksum-one"},
		}

		pending, alreadyApplied, err := plan(all, applied)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(pending) != 1 || pending[0].Identifier() != "000002_add_index" {
			t.Errorf("expected only 000002_add_index pending, got %v", pending)
		}
		if len(alreadyApplied) != 1 || alreadyApplied[0] != "000001_init_schema" {
			t.Errorf("expected 000001_init_schema already applied, got %v", alreadyApplied)
		}
	})

	t.Run("applied migration was edited", func(t *testing.T) {
		applied := map[string]appliedMigration{
			"000001": {Name: "init_schema", Checksum: "a-different-checksum"},
		}

		_, _, err := plan(all, applied)
		if err == nil {
			t.Fatal("expected an error when an applied migration changed, got nil")
		}
		if !strings.Contains(err.Error(), "contents changed") {
			t.Errorf("expected a checksum mismatch error, got %q", err.Error())
		}
	})
}

func TestEmbeddedMigrationsLoad(t *testing.T) {
	got, err := LoadMigrations(migrations.Files)
	if err != nil {
		t.Fatalf("expected the embedded migrations to load, got error: %v", err)
	}

	var initial *Migration
	for i := range got {
		if got[i].Identifier() == "000001_init_schema" {
			initial = &got[i]
		}
	}
	if initial == nil {
		t.Fatalf("expected 000001_init_schema in the embedded migrations, got %d migrations", len(got))
	}
	if !strings.Contains(initial.SQL, "CREATE TABLE IF NOT EXISTS notifications") {
		t.Error("expected the initial migration to create the notifications table")
	}
}
