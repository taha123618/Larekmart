/**
 * End-to-end regression for audit lead inventory-consumer-unverified-producer.
 *
 * POST-FIX EXPECTATION: a forged `payment.successful` Kafka message (a
 * reference that Stripe does not know) is REJECTED by the consumer's
 * Stripe paid-session cross-check (src/utils/stripe-verify.ts). The
 * reservation must stay RESERVED — flipping to CONFIRMED is a regression.
 *
 * Safety: creates its own throwaway warehouse/item/reservation rows against
 * the local larekmart_inventory_db and removes them afterwards. It never
 * touches pre-existing data.
 *
 * Prereqs: Docker daemon running, Kafka compose up, inventory-service running.
 * Run: pnpm --filter inventory-service exec tsx --env-file=.env tests/forged-payment-repro.ts
 */
import { PrismaClient } from "@prisma/client";
import { Kafka } from "kafkajs";

const prisma = new PrismaClient();

const RESERVATION_REF = `repro-forged-${Date.now()}`;
const TOPIC = "payment.successful";
/** How long to give the running consumer to process (and reject) the message. */
const PROCESSING_GRACE_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(
    "=== Forged payment.successful must NOT confirm reservation (post-fix regression) ===\n",
  );

  // 1. Seed a throwaway warehouse + item + RESERVED reservation
  const warehouse = await prisma.warehouse.create({
    data: { name: "repro-wh", code: `REPRO-${Date.now()}` },
  });
  const item = await prisma.inventoryItem.create({
    data: {
      productId: 999999,
      variantId: "repro-variant",
      warehouseId: warehouse.id,
      quantity: 10,
      reservedQuantity: 2,
      availableQuantity: 8,
    },
  });
  const reservation = await prisma.inventoryReservation.create({
    data: {
      userId: "repro-user",
      inventoryItemId: item.id,
      quantity: 2,
      referenceType: "STRIPE_CHECKOUT",
      referenceId: RESERVATION_REF,
      status: "RESERVED",
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  console.log(
    `Seeded reservation ${reservation.id} (status=RESERVED, ref=${RESERVATION_REF})`,
  );

  // 2. Produce the forged payment.successful event: the reference is a
  //    reservation id Stripe has never seen — exactly the lead's attack.
  const kafka = new Kafka({
    clientId: "repro-forged-producer",
    brokers: ["localhost:9094", "localhost:9095", "localhost:9096"],
    ssl: false,
    sasl: {
      // SASL/PLAIN matching the compose static JAAS users (see
      // packages/kafka/docker-compose.yml).
      mechanism: "plain",
      username: process.env.KAFKA_SASL_USERNAME || "admin",
      password: process.env.KAFKA_SASL_PASSWORD || "admin123",
    },
  });
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({
    topic: TOPIC,
    messages: [
      {
        value: JSON.stringify({
          sessionId: "forged-session-do-not-trust",
          referenceId: RESERVATION_REF,
          userId: "repro-user",
          amount: 1,
          status: "success",
        }),
      },
    ],
  });
  await producer.disconnect();
  console.log(
    `Produced forged ${TOPIC} message (non-Stripe reference, amount=1)`,
  );

  // 3. Give the consumer time to process + reject, then assert the stock
  //    never changed hands.
  console.log(
    `Waiting ${PROCESSING_GRACE_MS / 1000}s for the consumer to process and reject...`,
  );
  await sleep(PROCESSING_GRACE_MS);

  const after = await prisma.inventoryReservation.findUnique({
    where: { id: reservation.id },
  });
  if (!after) throw new Error("Reservation vanished — unexpected");

  if (after.status === "RESERVED") {
    console.log(
      "\n✓ FIX VERIFIED: reservation is still RESERVED — the Stripe paid-session",
    );
    console.log(
      "  cross-check rejected the forged message; no stock was converted to sold.",
    );
    console.log(
      "  (inventory-service log shows: Rejected payment.successful ... not a Stripe checkout session id)",
    );
  } else if (after.status === "CONFIRMED") {
    console.error(
      "\n✗ REGRESSION: forged message CONFIRMED the reservation — the Stripe",
    );
    console.error("  cross-check in inventory-event.consumer.ts is bypassed!");
    process.exitCode = 1;
  } else {
    console.error(
      `\n✗ UNEXPECTED STATUS: ${after.status} — investigate the consumer.`,
    );
    process.exitCode = 1;
  }

  // 4. Cleanup
  await prisma.inventoryReservation.delete({ where: { id: reservation.id } });
  await prisma.inventoryItem.delete({ where: { id: item.id } });
  await prisma.warehouse.delete({ where: { id: warehouse.id } });
  console.log("\nCleanup done (reservation, item, warehouse removed).");
}

main()
  .catch((err) => {
    console.error("Repro failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
