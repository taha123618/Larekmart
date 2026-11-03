import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("Running payout_db database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS payout_accounts (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT 'MOCK_BANK',
        account_holder_name VARCHAR(255) NOT NULL,
        account_number_masked VARCHAR(64) NOT NULL,
        routing_or_iban VARCHAR(64) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        schedule VARCHAR(32) NOT NULL DEFAULT 'WEEKLY',
        is_verified BOOLEAN NOT NULL DEFAULT false,
        is_default BOOLEAN NOT NULL DEFAULT true,
        hold_payouts BOOLEAN NOT NULL DEFAULT false,
        hold_reason TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_accounts_seller ON payout_accounts(seller_id);
      CREATE INDEX IF NOT EXISTS idx_payout_accounts_currency ON payout_accounts(currency);

      CREATE TABLE IF NOT EXISTS ledger_accounts (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64),
        account_type VARCHAR(64) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_accounts_seller ON ledger_accounts(seller_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON ledger_accounts(account_type);

      CREATE TABLE IF NOT EXISTS ledger_entries (
        id VARCHAR(64) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL,
        account_id VARCHAR(64) NOT NULL REFERENCES ledger_accounts(id),
        entry_type VARCHAR(16) NOT NULL,
        amount NUMERIC(18, 4) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        reference_type VARCHAR(64) NOT NULL,
        reference_id VARCHAR(64) NOT NULL,
        balance_after NUMERIC(18, 4),
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_txn ON ledger_entries(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_ref ON ledger_entries(reference_type, reference_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_created ON ledger_entries(created_at);

      CREATE TABLE IF NOT EXISTS payout_batches (
        id VARCHAR(64) PRIMARY KEY,
        batch_number VARCHAR(64) NOT NULL UNIQUE,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        total_payouts INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        scheduled_for TIMESTAMPTZ NOT NULL,
        reconciled_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status);
      CREATE INDEX IF NOT EXISTS idx_payout_batches_scheduled ON payout_batches(scheduled_for);

      CREATE TABLE IF NOT EXISTS payouts (
        id VARCHAR(64) PRIMARY KEY,
        payout_number VARCHAR(64) NOT NULL UNIQUE,
        batch_id VARCHAR(64) REFERENCES payout_batches(id),
        seller_id VARCHAR(64) NOT NULL,
        payout_account_id VARCHAR(64) NOT NULL REFERENCES payout_accounts(id),
        amount NUMERIC(18, 2) NOT NULL,
        fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        net_amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        idempotency_key VARCHAR(128) NOT NULL UNIQUE,
        provider_reference VARCHAR(128),
        failure_reason TEXT,
        processed_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payouts_seller ON payouts(seller_id);
      CREATE INDEX IF NOT EXISTS idx_payouts_batch ON payouts(batch_id);
      CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
      CREATE INDEX IF NOT EXISTS idx_payouts_idempotency ON payouts(idempotency_key);

      CREATE TABLE IF NOT EXISTS settlements (
        id VARCHAR(64) PRIMARY KEY,
        settlement_number VARCHAR(64) NOT NULL UNIQUE,
        seller_id VARCHAR(64) NOT NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        gross_sales NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        total_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        total_refunds NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        reserve_withheld NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        reserve_released NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        net_settlement NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        payout_id VARCHAR(64) REFERENCES payouts(id),
        status VARCHAR(32) NOT NULL DEFAULT 'CLOSED',
        statement_snapshot JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_settlements_seller ON settlements(seller_id);
      CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period_start, period_end);

      CREATE TABLE IF NOT EXISTS payout_adjustments (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL,
        payout_id VARCHAR(64) REFERENCES payouts(id),
        adjustment_type VARCHAR(64) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        reason TEXT NOT NULL,
        reference_id VARCHAR(64),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_adjustments_seller ON payout_adjustments(seller_id);
      CREATE INDEX IF NOT EXISTS idx_payout_adjustments_type ON payout_adjustments(adjustment_type);

      CREATE TABLE IF NOT EXISTS payout_provider_events (
        id VARCHAR(64) PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        event_id VARCHAR(128) NOT NULL UNIQUE,
        event_type VARCHAR(64) NOT NULL,
        payout_id VARCHAR(64),
        payload JSONB NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_provider_events_payout ON payout_provider_events(payout_id);
      CREATE INDEX IF NOT EXISTS idx_payout_provider_events_event ON payout_provider_events(event_id);
    `);

    console.log("payout_db database tables and indexes verified successfully.");
  } catch (err) {
    console.warn("Migration warning (continuing if table exists):", err);
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
