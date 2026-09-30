import assert from "assert";
import {
  ProductFormSchema,
  CategoryFormSchema,
  ShipmentStatusSchema,
  ShippingAddressSnapshotSchema,
  ShippingRateRequestSchema,
  ShipmentStatusEnum,
  CreateCodOrderSchema,
} from "../src/index.js";

async function runSchemaTests() {
  console.log("=== Domain Contracts & Zod Schemas SQA Test Suite ===\n");

  // 1. ProductFormSchema Valid Case
  console.log("1. Testing ProductFormSchema Valid Case...");
  const validProduct = {
    name: "Classic Linen Shirt",
    shortDescription: "Breathable pure linen shirt for summer",
    description:
      "Detailed description of the linen shirt with washing instructions.",
    price: 3499,
    categorySlug: "shirts",
    sizes: ["m", "l", "xl"],
    colors: ["blue", "white"],
    images: {
      blue: "https://example.com/images/blue.jpg",
      white: "https://example.com/images/white.jpg",
    },
  };
  const parsedProduct = ProductFormSchema.safeParse(validProduct);
  assert.equal(
    parsedProduct.success,
    true,
    "Valid product payload should parse successfully",
  );
  console.log("✓ Valid ProductFormSchema successfully parsed");

  // 2. ProductFormSchema Validation Errors
  console.log("2. Testing ProductFormSchema Validation Invariants...");

  // A. Missing image for selected color
  const missingColorImageProduct = {
    ...validProduct,
    colors: ["blue", "white", "red"], // 'red' has no image in images map
  };
  const missingImgResult = ProductFormSchema.safeParse(
    missingColorImageProduct,
  );
  assert.equal(
    missingImgResult.success,
    false,
    "Product missing image for selected color must fail",
  );
  assert.match(
    missingImgResult.error?.issues[0]?.message || "",
    /Image is required for each selected color/,
    "Expected error message for missing color image",
  );

  // B. Price <= 0
  const zeroPriceProduct = { ...validProduct, price: 0 };
  const zeroPriceResult = ProductFormSchema.safeParse(zeroPriceProduct);
  assert.equal(
    zeroPriceResult.success,
    false,
    "Product with price 0 must fail",
  );

  // C. Short description exceeding 60 characters
  const longDescProduct = {
    ...validProduct,
    shortDescription:
      "This short description exceeds the maximum sixty character length limit by far!",
  };
  const longDescResult = ProductFormSchema.safeParse(longDescProduct);
  assert.equal(
    longDescResult.success,
    false,
    "Short description > 60 chars must fail",
  );

  // D. Empty size array
  const noSizeProduct = { ...validProduct, sizes: [] };
  const noSizeResult = ProductFormSchema.safeParse(noSizeProduct);
  assert.equal(noSizeResult.success, false, "Product with no sizes must fail");
  console.log("✓ ProductFormSchema boundary invariants strictly enforced");

  // 3. CategoryFormSchema Validation
  console.log("3. Testing CategoryFormSchema...");
  const validCategory = { name: "Kurtas", slug: "kurtas" };
  const parsedCategory = CategoryFormSchema.safeParse(validCategory);
  assert.equal(parsedCategory.success, true);

  const emptyCategorySlug = { name: "Kurtas", slug: "" };
  assert.equal(CategoryFormSchema.safeParse(emptyCategorySlug).success, false);
  console.log("✓ CategoryFormSchema verified");

  // 4. ShipmentStatus State Machine
  console.log("4. Testing ShipmentStatusSchema State Machine...");
  for (const status of ShipmentStatusEnum) {
    const parseResult = ShipmentStatusSchema.safeParse(status);
    assert.equal(
      parseResult.success,
      true,
      `Status '${status}' should be a valid shipment status`,
    );
  }
  const invalidStatusResult = ShipmentStatusSchema.safeParse("UNKNOWN_STATE");
  assert.equal(
    invalidStatusResult.success,
    false,
    "Unknown shipment status must be rejected",
  );
  console.log("✓ ShipmentStatusSchema all 11 lifecycle statuses verified");

  // 5. ShippingAddressSnapshotSchema
  console.log("5. Testing ShippingAddressSnapshotSchema...");
  const validAddress = {
    fullName: "Ayesha Khan",
    phone: "+923001234567",
    addressLine1: "House 10, St 5, F-7/2",
    city: "Islamabad",
    postalCode: "44000",
  };
  const parsedAddress = ShippingAddressSnapshotSchema.safeParse(validAddress);
  assert.equal(parsedAddress.success, true);
  if (parsedAddress.success) {
    assert.equal(
      parsedAddress.data.country,
      "PK",
      "Default country should be PK",
    );
  }

  // Missing phone number
  const noPhoneAddress = { ...validAddress, phone: "" };
  assert.equal(
    ShippingAddressSnapshotSchema.safeParse(noPhoneAddress).success,
    false,
  );
  console.log("✓ ShippingAddressSnapshotSchema verified");

  // 6. ShippingRateRequestSchema
  console.log("6. Testing ShippingRateRequestSchema...");
  const validRateReq = {
    city: "Lahore",
    weight: 2.0,
    items: [{ productId: "p1", quantity: 2, weight: 1.0, price: 2000 }],
    isCod: true,
  };
  const parsedRateReq = ShippingRateRequestSchema.safeParse(validRateReq);
  assert.equal(parsedRateReq.success, true);

  // Negative quantity must be rejected
  const invalidRateReq = {
    city: "Lahore",
    items: [{ productId: "p1", quantity: -1 }],
  };
  assert.equal(
    ShippingRateRequestSchema.safeParse(invalidRateReq).success,
    false,
  );
  console.log(
    "✓ ShippingRateRequestSchema positive integer quantities verified",
  );

  // 7. CreateCodOrderSchema pricing invariants (regression: price integrity)
  console.log("7. Testing CreateCodOrderSchema pricing invariants...");
  const validCodOrder = {
    email: "buyer@example.com",
    amount: 350030,
    shippingRateAmount: 20000,
    codFee: 3000,
    shippingAddress: {
      fullName: "Ayesha Khan",
      phone: "+923001234567",
      addressLine1: "House 10, St 5",
      city: "Lahore",
      postalCode: "54000",
      country: "PK",
    },
    products: [{ productId: 42, quantity: 1, price: 349900 }],
  };
  const parsedCod = CreateCodOrderSchema.safeParse(validCodOrder);
  assert.equal(parsedCod.success, true, "Valid COD order should parse");
  if (parsedCod.success) {
    assert.equal(
      parsedCod.data.discountTotal,
      0,
      "discountTotal defaults to 0",
    );
    assert.equal(parsedCod.data.taxTotal, 0, "taxTotal defaults to 0");
  }

  // Non-integer amounts must fail (paisa contract)
  assert.equal(
    CreateCodOrderSchema.safeParse({ ...validCodOrder, amount: 3500.5 })
      .success,
    false,
    "Fractional paisa amount must be rejected",
  );

  // Products without a server product id must fail
  assert.equal(
    CreateCodOrderSchema.safeParse({
      ...validCodOrder,
      products: [{ quantity: 1, price: 349900 }],
    }).success,
    false,
    "COD product without productId must be rejected",
  );
  assert.equal(
    CreateCodOrderSchema.safeParse({
      ...validCodOrder,
      products: [{ productId: 0, quantity: 1 }],
    }).success,
    false,
    "Non-positive productId must be rejected",
  );
  console.log("✓ CreateCodOrderSchema paisa + productId invariants verified");

  console.log("\n=======================================================");
  console.log(" All Domain Schema SQA Test Cases Passed Successfully! ");
  console.log("=======================================================\n");
}

runSchemaTests().catch((err) => {
  console.error("Schema test failed:", err);
  process.exit(1);
});
