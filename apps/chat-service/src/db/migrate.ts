import pg from "pg";
import { env } from "../config/env.js";

const { Client } = pg;

export async function runMigrations(): Promise<void> {
  console.log("Running chat-service database migrations...");

  const client = new Client({
    connectionString: env.DIRECT_URL || env.DATABASE_URL,
  });

  await client.connect();

  try {
    await client.query("BEGIN;");

    // 1. Conversations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(64) PRIMARY KEY,
        type VARCHAR(32) NOT NULL DEFAULT 'DIRECT_BUYER_SELLER',
        title VARCHAR(255),
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        seller_id VARCHAR(128),
        order_id VARCHAR(128),
        ticket_id VARCHAR(128),
        created_by_id VARCHAR(128) NOT NULL,
        last_message_id VARCHAR(64),
        last_message_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Conversation Participants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'BUYER',
        last_read_at TIMESTAMPTZ,
        unread_count INTEGER NOT NULL DEFAULT 0,
        is_muted BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        left_at TIMESTAMPTZ
      );
    `);

    // 3. Messages Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id VARCHAR(128) NOT NULL,
        sender_role VARCHAR(32) NOT NULL DEFAULT 'BUYER',
        message_type VARCHAR(32) NOT NULL DEFAULT 'TEXT',
        content TEXT NOT NULL,
        reply_to_message_id VARCHAR(64),
        is_edited BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        is_reported BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Message Receipts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_receipts (
        id VARCHAR(64) PRIMARY KEY,
        message_id VARCHAR(64) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'SENT',
        delivered_at TIMESTAMPTZ,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Message Attachments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id VARCHAR(64) PRIMARY KEY,
        message_id VARCHAR(64) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        media_file_id VARCHAR(128) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 6. Conversation Blocks Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_blocks (
        id VARCHAR(64) PRIMARY KEY,
        blocker_user_id VARCHAR(128) NOT NULL,
        blocked_user_id VARCHAR(128) NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS conversations_type_idx ON conversations(type);
      CREATE INDEX IF NOT EXISTS conversations_status_idx ON conversations(status);
      CREATE INDEX IF NOT EXISTS conversations_seller_id_idx ON conversations(seller_id);
      CREATE INDEX IF NOT EXISTS conversations_order_id_idx ON conversations(order_id);
      CREATE INDEX IF NOT EXISTS conversations_ticket_id_idx ON conversations(ticket_id);
      CREATE INDEX IF NOT EXISTS conversations_created_by_id_idx ON conversations(created_by_id);
      CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON conversations(last_message_at);

      CREATE UNIQUE INDEX IF NOT EXISTS conversation_participants_conv_user_idx ON conversation_participants(conversation_id, user_id);
      CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON conversation_participants(user_id);
      CREATE INDEX IF NOT EXISTS conversation_participants_role_idx ON conversation_participants(role);

      CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
      CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON messages(reply_to_message_id);
      CREATE INDEX IF NOT EXISTS messages_is_reported_idx ON messages(is_reported);

      CREATE UNIQUE INDEX IF NOT EXISTS message_receipts_msg_user_idx ON message_receipts(message_id, user_id);
      CREATE INDEX IF NOT EXISTS message_receipts_user_id_idx ON message_receipts(user_id);
      CREATE INDEX IF NOT EXISTS message_receipts_status_idx ON message_receipts(status);

      CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx ON message_attachments(message_id);
      CREATE INDEX IF NOT EXISTS message_attachments_media_file_id_idx ON message_attachments(media_file_id);

      CREATE UNIQUE INDEX IF NOT EXISTS conversation_blocks_pair_idx ON conversation_blocks(blocker_user_id, blocked_user_id);
      CREATE INDEX IF NOT EXISTS conversation_blocks_blocker_idx ON conversation_blocks(blocker_user_id);
      CREATE INDEX IF NOT EXISTS conversation_blocks_blocked_idx ON conversation_blocks(blocked_user_id);
    `);

    await client.query("COMMIT;");
    console.log("chat-service database migrations completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations().catch((err) => {
    console.error("Failed to run migrations:", err);
    process.exit(1);
  });
}
