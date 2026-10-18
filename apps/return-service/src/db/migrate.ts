import { getPool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    console.log("Running return-service MySQL database migrations...");

    // 1. return_policy_versions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_policy_versions (
        id VARCHAR(36) PRIMARY KEY,
        version VARCHAR(32) NOT NULL UNIQUE,
        return_window_days INT NOT NULL DEFAULT 14,
        warranty_grace_days INT NOT NULL DEFAULT 30,
        restocking_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        requires_receipt BOOLEAN NOT NULL DEFAULT TRUE,
        effective_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. return_reasons
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_reasons (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(128) NOT NULL,
        description TEXT NULL,
        requires_evidence BOOLEAN NOT NULL DEFAULT FALSE,
        is_seller_fault BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. returns
    await conn.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(128) NOT NULL,
        customer_id VARCHAR(128) NOT NULL,
        seller_id VARCHAR(128) NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'REQUESTED',
        reason_category VARCHAR(64) NOT NULL,
        customer_comments TEXT NULL,
        subtotal_refund DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        tax_refund DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        shipping_deduction DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        total_refund DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        policy_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
        requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
        auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
        delivered_at TIMESTAMP NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        received_at TIMESTAMP NULL,
        inspected_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        cancelled_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_returns_order_id (order_id),
        INDEX idx_returns_customer_id (customer_id),
        INDEX idx_returns_seller_id (seller_id),
        INDEX idx_returns_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. return_items
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_items (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) NOT NULL,
        order_item_id VARCHAR(128) NOT NULL,
        product_id VARCHAR(128) NOT NULL,
        variant_id VARCHAR(128) NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        item_discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        prorated_tax DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        refund_subtotal DECIMAL(12, 2) NOT NULL,
        reason VARCHAR(64) NOT NULL,
        \`condition\` VARCHAR(64) NOT NULL DEFAULT 'UNOPENED',
        customer_note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        INDEX idx_return_items_return_id (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. return_media
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_media (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) NOT NULL,
        media_id VARCHAR(128) NOT NULL,
        url VARCHAR(512) NOT NULL,
        media_type VARCHAR(32) NOT NULL DEFAULT 'PHOTO',
        uploader_role VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER',
        caption TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        INDEX idx_return_media_return_id (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. return_shipments
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_shipments (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) NOT NULL,
        carrier_name VARCHAR(64) NOT NULL,
        tracking_number VARCHAR(128) NOT NULL,
        label_url VARCHAR(512) NULL,
        is_prepaid BOOLEAN NOT NULL DEFAULT FALSE,
        paid_by VARCHAR(32) NOT NULL DEFAULT 'SELLER',
        shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        tracking_status VARCHAR(64) NOT NULL DEFAULT 'LABEL_CREATED',
        shipped_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        INDEX idx_return_shipments_return_id (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. return_inspections
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_inspections (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) NOT NULL,
        inspector_id VARCHAR(128) NOT NULL,
        overall_condition VARCHAR(64) NOT NULL,
        disposition VARCHAR(64) NOT NULL,
        notes TEXT NULL,
        inspected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        INDEX idx_return_inspections_return_id (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. return_refunds
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_refunds (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) NOT NULL,
        payment_intent_id VARCHAR(128) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL UNIQUE,
        amount DECIMAL(12, 2) NOT NULL,
        tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        shipping_deduction DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        stripe_refund_id VARCHAR(128) NULL,
        failure_reason TEXT NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        INDEX idx_return_refunds_return_id (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. return_state_transitions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_state_transitions (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) NOT NULL,
        previous_state VARCHAR(64) NOT NULL,
        new_state VARCHAR(64) NOT NULL,
        actor_id VARCHAR(128) NOT NULL,
        actor_role VARCHAR(32) NOT NULL,
        reason_note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        INDEX idx_return_transitions_return_id (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. return_outbox
    await conn.query(`
      CREATE TABLE IF NOT EXISTS return_outbox (
        id VARCHAR(36) PRIMARY KEY,
        topic VARCHAR(128) NOT NULL,
        event_key VARCHAR(128) NULL,
        payload TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        retry_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        published_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_return_outbox_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("return-service MySQL migrations completed successfully.");
  } finally {
    conn.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
