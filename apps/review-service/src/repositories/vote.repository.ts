import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { reviewVotes, reviews } from "../db/schema.js";

export class VoteRepository {
  async getVote(reviewId: string, userId: string) {
    const [vote] = await db
      .select()
      .from(reviewVotes)
      .where(
        and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)),
      )
      .limit(1);

    return vote || null;
  }

  async castVote(
    reviewId: string,
    userId: string,
    voteType: "HELPFUL" | "UNHELPFUL",
  ) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(reviewVotes)
        .where(
          and(
            eq(reviewVotes.reviewId, reviewId),
            eq(reviewVotes.userId, userId),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.voteType === voteType) {
          // User clicked the same vote again -> remove vote (toggle off)
          await tx
            .delete(reviewVotes)
            .where(
              and(
                eq(reviewVotes.reviewId, reviewId),
                eq(reviewVotes.userId, userId),
              ),
            );

          if (voteType === "HELPFUL") {
            await tx
              .update(reviews)
              .set({
                helpfulCount: sql`GREATEST(0, ${reviews.helpfulCount} - 1)`,
              })
              .where(eq(reviews.id, reviewId));
          } else {
            await tx
              .update(reviews)
              .set({
                unhelpfulCount: sql`GREATEST(0, ${reviews.unhelpfulCount} - 1)`,
              })
              .where(eq(reviews.id, reviewId));
          }

          return { action: "removed", voteType };
        } else {
          // User switched vote (e.g. from HELPFUL to UNHELPFUL)
          await tx
            .update(reviewVotes)
            .set({ voteType })
            .where(
              and(
                eq(reviewVotes.reviewId, reviewId),
                eq(reviewVotes.userId, userId),
              ),
            );

          if (voteType === "HELPFUL") {
            await tx
              .update(reviews)
              .set({
                helpfulCount: sql`${reviews.helpfulCount} + 1`,
                unhelpfulCount: sql`GREATEST(0, ${reviews.unhelpfulCount} - 1)`,
              })
              .where(eq(reviews.id, reviewId));
          } else {
            await tx
              .update(reviews)
              .set({
                unhelpfulCount: sql`${reviews.unhelpfulCount} + 1`,
                helpfulCount: sql`GREATEST(0, ${reviews.helpfulCount} - 1)`,
              })
              .where(eq(reviews.id, reviewId));
          }

          return { action: "switched", voteType };
        }
      }

      // New vote
      await tx.insert(reviewVotes).values({
        reviewId,
        userId,
        voteType,
      });

      if (voteType === "HELPFUL") {
        await tx
          .update(reviews)
          .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
          .where(eq(reviews.id, reviewId));
      } else {
        await tx
          .update(reviews)
          .set({ unhelpfulCount: sql`${reviews.unhelpfulCount} + 1` })
          .where(eq(reviews.id, reviewId));
      }

      return { action: "added", voteType };
    });
  }
}

export const voteRepository = new VoteRepository();
