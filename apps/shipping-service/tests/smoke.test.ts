import { ProviderRegistry } from "../src/providers/registry.js";
import { RateService } from "../src/services/rate.service.js";
import { ShipmentRepository } from "../src/repositories/shipment.repository.js";

async function runSmokeTest() {
  console.log("1. Initializing providers...");
  ProviderRegistry.initialize();
  const carriers = ProviderRegistry.getAllProviders().map((p) => p.carrierCode);
  console.log("Registered carriers:", carriers);

  console.log("2. Seeding default shipping methods in database...");
  await ShipmentRepository.seedDefaultMethodsIfEmpty();

  console.log("3. Calculating shipping rates for Karachi (weight 2.5kg)...");
  const result = await RateService.calculateRates({
    country: "PK",
    city: "Karachi",
    postalCode: "74000",
    weight: 2.5,
    items: [
      {
        productId: "prod_123",
        quantity: 2,
        weight: 1.25,
      },
    ],
  });

  console.log("Currency:", result.currency);
  console.log("Returned rates count:", result.rates.length);
  result.rates.forEach((r) => {
    console.log(
      `- [${r.carrier.toUpperCase()}] ${r.name} (${r.service}): ${r.currency} ${r.amount} (est: ${r.estimatedDaysMin}-${r.estimatedDaysMax} days)`,
    );
  });

  if (result.rates.length === 0) {
    throw new Error("Expected at least 1 rate to be returned");
  }

  console.log("4. Testing shipment creation with TCS adapter...");
  const { ShipmentService } = await import(
    "../src/services/shipment.service.js"
  );
  const orderId1 = `ord_smoke_test_${Date.now()}`;
  const shipment = await ShipmentService.createShipment({
    orderId: orderId1,
    userId: "usr_test_123",
    carrier: "tcs",
    serviceType: "express",
    shippingAddress: {
      fullName: "Muhammad Ali",
      phone: "+923001234567",
      addressLine1: "House 45, Street 12, DHA Phase 5",
      city: "Karachi",
      postalCode: "74000",
      country: "PK",
    },
    items: [
      {
        productId: "prod_123",
        name: "Premium Cotton Kurta",
        quantity: 1,
        price: 3500,
        weight: 0.5,
      },
    ],
    packages: [
      {
        weight: 0.5,
        length: 30,
        width: 20,
        height: 5,
        packageType: "bag",
      },
    ],
    shippingRateAmount: 450,
    currency: "PKR",
  });

  console.log("Created shipment ID:", shipment.id);
  console.log("Tracking Number:", shipment.trackingNumber);
  console.log("Status:", shipment.status);
  console.log("Labels generated count:", shipment.labels.length);

  console.log("5. Testing shipment status retrieval...");
  const retrieved = await ShipmentService.getShipmentById(shipment.id);
  if (retrieved.id !== shipment.id) {
    throw new Error("Failed to retrieve matching shipment");
  }

  console.log("6. Testing tracking retrieval via TrackingService...");
  const { TrackingService } = await import(
    "../src/services/tracking.service.js"
  );
  const tracking = await TrackingService.getTracking(shipment.id);
  console.log("Tracking milestones count:", tracking.events.length);
  console.log("Tracking status:", tracking.status);

  console.log("7. Testing Cash on Delivery (COD) Rate Calculation (Amount: 5000 PKR)...");
  const codRateResult = await RateService.calculateRates({
    country: "PK",
    city: "Lahore",
    postalCode: "54000",
    weight: 1.5,
    isCod: true,
    codAmount: 5000,
  });

  const codEligible = codRateResult.rates.filter((r) => r.isCodAvailable);
  console.log("COD Eligible courier services count:", codEligible.length);
  codEligible.forEach((r) => {
    console.log(
      `  - [${r.carrier.toUpperCase()}] ${r.name}: Base PKR ${r.amount}, COD Fee: PKR ${r.codFee}`,
    );
  });
  if (codEligible.length === 0) {
    throw new Error("Expected at least 1 COD-eligible rate to be returned");
  }

  console.log("8. Testing COD Shipment Creation with Leopards Courier...");
  const codOrderId = `ord_smoke_cod_${Date.now()}`;
  const codShipment = await ShipmentService.createShipment({
    orderId: codOrderId,
    userId: "usr_test_456",
    carrier: "leopards",
    serviceType: "standard",
    isCod: true,
    codAmount: 5000,
    shippingAddress: {
      fullName: "Fatima Noor",
      phone: "+923219876543",
      addressLine1: "Flat 12B, Gulberg Heights",
      city: "Lahore",
      postalCode: "54000",
      country: "PK",
    },
    items: [
      {
        productId: "prod_embroidered_suit",
        name: "Lawn Embroidered 3-Piece Suit",
        quantity: 1,
        price: 5000,
        weight: 1.0,
      },
    ],
    packages: [
      {
        weight: 1.0,
        packageType: "box",
      },
    ],
    shippingRateAmount: 220,
    currency: "PKR",
  });

  console.log("Created COD Shipment ID:", codShipment.id);
  console.log("Is COD:", codShipment.isCod);
  console.log("COD Amount to Collect:", codShipment.codAmount);
  console.log("COD Fee:", codShipment.codFee);
  console.log("Initial COD Status:", codShipment.codStatus);

  if (!codShipment.isCod || codShipment.codAmount !== 5000 || codShipment.codStatus !== "PENDING_COLLECTION") {
    throw new Error("COD shipment initialization attributes mismatch");
  }

  console.log("9. Testing COD Delivery & Cash Collection Lifecycle Transition...");
  await TrackingService.recordTrackingEvent({
    shipmentId: codShipment.id,
    status: "DELIVERED",
    description: "Package delivered to consignee. Cash of PKR 5000 collected by courier rider.",
    location: "Gulberg Lahore",
    source: "manual",
  });

  const deliveredCodShipment = await ShipmentService.getShipmentById(codShipment.id);
  console.log("Updated Shipment Status:", deliveredCodShipment.status);
  console.log("Updated COD Status:", deliveredCodShipment.codStatus);

  if (deliveredCodShipment.status !== "DELIVERED" || deliveredCodShipment.codStatus !== "COLLECTED") {
    throw new Error("COD status failed to transition to COLLECTED upon DELIVERED event");
  }

  console.log("Smoke test and COD workflows completed successfully!");
  process.exit(0);
}

runSmokeTest().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
