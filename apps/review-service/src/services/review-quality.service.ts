import { z } from "zod";

export interface ReviewQualityEvaluation {
  qualityScore: number;
  authenticityScore: number;
  signals: {
    verifiedPurchase: boolean;
    hasMedia: boolean;
    detailedLength: boolean;
    duplicateTextFlag: boolean;
    spamPatternFlag: boolean;
  };
  tier: "HIGH_QUALITY" | "STANDARD" | "LOW_QUALITY" | "SUSPICIOUS";
}

export interface ImageModerationResult {
  imageUrl: string;
  decision: "APPROVED" | "FLAGGED_FOR_REVIEW" | "REJECTED";
  reasons: string[];
}

export const ReviewQualityInputSchema = z.object({
  title: z.string().default(""),
  body: z.string().min(1),
  verifiedPurchase: z.boolean().default(false),
  mediaUrls: z.array(z.string()).default([]),
});

export const ImageModerationInputSchema = z.object({
  imageUrl: z.string().url(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional(),
});

const seenReviewHashes = new Set<string>();
const SPAM_PATTERNS = [/buy\s+followers/i, /http[s]?:\/\/bit\.ly/i, /whatsapp\s+me/i];

export function evaluateReviewQuality(
  input: z.infer<typeof ReviewQualityInputSchema>,
): ReviewQualityEvaluation {
  const normalized = `${input.title} ${input.body}`.trim().toLowerCase();
  const duplicateTextFlag = seenReviewHashes.has(normalized);
  seenReviewHashes.add(normalized);

  const spamPatternFlag = SPAM_PATTERNS.some((rx) => rx.test(normalized));
  const detailedLength = input.body.trim().length >= 50;
  const hasMedia = input.mediaUrls.length > 0;

  let qualityScore = 25;
  if (detailedLength) qualityScore += 30;
  if (input.title.trim().length >= 5) qualityScore += 15;
  if (hasMedia) qualityScore += 20;
  if (input.verifiedPurchase) qualityScore += 10;
  if (spamPatternFlag) qualityScore = Math.max(0, qualityScore - 50);

  let authenticityScore = input.verifiedPurchase ? 85 : 50;
  if (duplicateTextFlag) authenticityScore -= 40;
  if (spamPatternFlag) authenticityScore -= 45;
  if (hasMedia) authenticityScore += 10;
  authenticityScore = Math.max(0, Math.min(100, authenticityScore));

  let tier: ReviewQualityEvaluation["tier"] = "STANDARD";
  if (spamPatternFlag || authenticityScore < 35) tier = "SUSPICIOUS";
  else if (qualityScore >= 80) tier = "HIGH_QUALITY";
  else if (qualityScore < 40) tier = "LOW_QUALITY";

  return {
    qualityScore: Math.min(100, qualityScore),
    authenticityScore,
    signals: {
      verifiedPurchase: input.verifiedPurchase,
      hasMedia,
      detailedLength,
      duplicateTextFlag,
      spamPatternFlag,
    },
    tier,
  };
}

export function moderateReviewImage(
  input: z.infer<typeof ImageModerationInputSchema>,
): ImageModerationResult {
  const reasons: string[] = [];
  const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (input.mimeType && !allowedMimes.has(input.mimeType)) {
    reasons.push(`Unsupported MIME type: ${input.mimeType}`);
  }
  if (input.sizeBytes && input.sizeBytes > 5 * 1024 * 1024) {
    reasons.push("Image exceeds 5MB limit");
  }
  if (/explicit|nsfw|malware/i.test(input.imageUrl)) {
    reasons.push("Flagged URL keyword pattern");
  }

  return {
    imageUrl: input.imageUrl,
    decision:
      reasons.some((r) => r.includes("Unsupported") || r.includes("exceeds"))
        ? "REJECTED"
        : reasons.length > 0
          ? "FLAGGED_FOR_REVIEW"
          : "APPROVED",
    reasons,
  };
}
