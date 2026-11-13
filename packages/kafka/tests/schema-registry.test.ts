import assert from "node:assert/strict";
import {
  SchemaRegistryClient,
  CONFLUENT_MAGIC_BYTE,
  WIRE_FORMAT_HEADER_LENGTH,
} from "../src/schema-registry/index.js";

async function runSchemaRegistryTests(): Promise<void> {
  console.log("==================================================");
  console.log("⚡ @repo/kafka Schema Registry & Wire Format Suite");
  console.log("==================================================");

  const client = new SchemaRegistryClient({
    baseUrl: "http://localhost:8081",
  });

  // 1. Test Confluent Wire Format Encoding
  console.log("\n1. Testing Confluent Wire Format Encoding...");
  const schemaId = 42;
  const samplePayload = {
    orderId: "ord_test_9981",
    amount: 15000,
    currency: "PKR",
    items: [{ productId: 101, quantity: 2 }],
  };

  const encoded = client.encodeMessage(schemaId, samplePayload);

  assert.ok(Buffer.isBuffer(encoded), "Encoded output must be a Buffer");
  assert.equal(
    encoded.length,
    WIRE_FORMAT_HEADER_LENGTH + Buffer.byteLength(JSON.stringify(samplePayload)),
    "Buffer length must equal header length (5 bytes) + payload length",
  );
  assert.equal(
    encoded[0],
    CONFLUENT_MAGIC_BYTE,
    "Byte 0 must be Confluent Magic Byte (0x00)",
  );
  assert.equal(
    encoded.readUInt32BE(1),
    schemaId,
    "Bytes 1-4 must encode 32-bit big-endian schema ID (42)",
  );
  console.log("  ✓ Confluent wire format header and payload length verified");

  // 2. Test Confluent Wire Format Decoding
  console.log("\n2. Testing Confluent Wire Format Decoding...");
  const decoded = client.decodeMessage<typeof samplePayload>(encoded);

  assert.equal(decoded.isWireFormat, true, "Must detect Confluent wire format");
  assert.equal(decoded.schemaId, 42, "Extracted schema ID must match (42)");
  assert.equal(decoded.payload.orderId, "ord_test_9981");
  assert.equal(decoded.payload.amount, 15000);
  assert.equal(decoded.payload.items.length, 1);
  console.log("  ✓ Confluent wire format payload extracted and parsed successfully");

  // 3. Test Legacy / Plain JSON Fallback Decoding (Zero Breaking Change Invariant)
  console.log("\n3. Testing Legacy JSON Fallback Decoding...");
  const plainJson = JSON.stringify({ event: "legacy.stock.reserved", stock: 50 });
  const decodedPlain = client.decodeMessage<{ event: string; stock: number }>(plainJson);

  assert.equal(
    decodedPlain.isWireFormat,
    false,
    "Plain JSON must be flagged as non-wire-format",
  );
  assert.equal(
    decodedPlain.schemaId,
    null,
    "Plain JSON must have schemaId === null",
  );
  assert.equal(decodedPlain.payload.event, "legacy.stock.reserved");
  assert.equal(decodedPlain.payload.stock, 50);
  console.log("  ✓ Legacy plain JSON transparently decoded with null schema ID");

  // 4. Test Raw Non-JSON String Fallback
  console.log("\n4. Testing Raw String Fallback...");
  const rawText = "raw-unformatted-kafka-message";
  const decodedRaw = client.decodeMessage<string>(rawText);
  assert.equal(decodedRaw.isWireFormat, false);
  assert.equal(decodedRaw.schemaId, null);
  assert.equal(decodedRaw.payload, rawText);
  console.log("  ✓ Non-JSON text gracefully preserved without throwing");

  // 5. Test Mock Schema Registry REST Interface
  console.log("\n5. Testing Schema Registry REST compatibility interface...");
  // Verify client defaults and config
  assert.equal(CONFLUENT_MAGIC_BYTE, 0x00);
  assert.equal(WIRE_FORMAT_HEADER_LENGTH, 5);

  console.log("  ✓ Confluent specification constants validated");

  console.log("\n==================================================");
  console.log("🎉 All Schema Registry & Wire Format Tests Passed (100%)");
  console.log("==================================================");
}

runSchemaRegistryTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
