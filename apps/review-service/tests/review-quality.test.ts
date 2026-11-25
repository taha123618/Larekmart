import assert from "node:assert/strict";
import {
  evaluateReviewQuality,
  moderateReviewImage,
} from "../src/services/review-quality.service.js";

console.log("=== review-service Quality, Authenticity & Image Moderation Tests ===");

const high = evaluateReviewQuality({
  title: "Great noise cancellation",
  body: "Used these headphones on two flights and the battery lasted over 28 hours with clear call quality.",
  verifiedPurchase: true,
  mediaUrls: ["https://cdn.larekmart.com/reviews/img1.webp"],
});
assert.equal(high.tier, "HIGH_QUALITY");
assert.ok(high.authenticityScore >= 90);

const spam = evaluateReviewQuality({
  title: "Click link",
  body: "Visit https://bit.ly/free-money or whatsapp me for deals",
  verifiedPurchase: false,
  mediaUrls: [],
});
assert.equal(spam.tier, "SUSPICIOUS");
assert.equal(spam.signals.spamPatternFlag, true);

const imgOk = moderateReviewImage({
  imageUrl: "https://cdn.larekmart.com/reviews/photo.webp",
  mimeType: "image/webp",
  sizeBytes: 250_000,
});
assert.equal(imgOk.decision, "APPROVED");

const imgBad = moderateReviewImage({
  imageUrl: "https://cdn.larekmart.com/reviews/file.exe",
  mimeType: "application/x-msdownload",
  sizeBytes: 1024,
});
assert.equal(imgBad.decision, "REJECTED");
console.log("  ✔ Review quality scoring, authenticity signals, and image moderation verified");
