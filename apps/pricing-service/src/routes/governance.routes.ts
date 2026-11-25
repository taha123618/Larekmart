import type { FastifyInstance } from "fastify";
import { requireAdminOrInternal } from "../middleware/auth.middleware.js";
import {
  BulkPriceApprovalSchema,
  PriceExperimentSchema,
  PriceFloorSchema,
  assignExperimentPrice,
  createPriceExperiment,
  reviewPriceApproval,
  setPriceFloor,
  submitBulkPriceApproval,
  validatePriceAgainstFloor,
} from "../services/pricing-governance.service.js";

export async function governanceRoutes(app: FastifyInstance): Promise<void> {
  app.put("/floors", { preHandler: requireAdminOrInternal }, async (request, reply) => {
    const parsed = PriceFloorSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: "Invalid price floor payload", issues: parsed.error.issues });
    }
    const actor = (request.headers["x-user-id"] as string) || "admin";
    const rule = setPriceFloor(parsed.data, actor);
    return reply.send({ rule });
  });

  app.post("/floors/validate", { preHandler: requireAdminOrInternal }, async (request, reply) => {
    const body = (request.body ?? {}) as { productId?: string; proposedPrice?: number; costBasis?: number };
    if (!body.productId || typeof body.proposedPrice !== "number") {
      return reply.status(400).send({ message: "productId and proposedPrice are required" });
    }
    return reply.send(validatePriceAgainstFloor(body.productId, body.proposedPrice, body.costBasis));
  });

  app.post("/experiments", { preHandler: requireAdminOrInternal }, async (request, reply) => {
    const parsed = PriceExperimentSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: "Invalid experiment payload", issues: parsed.error.issues });
    }
    try {
      const experiment = createPriceExperiment(parsed.data);
      return reply.status(201).send({ experiment });
    } catch (err: unknown) {
      return reply.status(400).send({ message: err instanceof Error ? err.message : "Failed" });
    }
  });

  app.get("/experiments/:id/assign", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { seed } = request.query as { seed?: string };
    try {
      return reply.send(assignExperimentPrice(id, seed || "anonymous"));
    } catch (err: unknown) {
      return reply.status(404).send({ message: err instanceof Error ? err.message : "Not found" });
    }
  });

  app.post("/approvals/bulk", { preHandler: requireAdminOrInternal }, async (request, reply) => {
    const parsed = BulkPriceApprovalSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: "Invalid bulk approval payload", issues: parsed.error.issues });
    }
    try {
      const actor = (request.headers["x-user-id"] as string) || "seller";
      const approval = submitBulkPriceApproval(parsed.data, actor);
      return reply.status(201).send({ approval });
    } catch (err: unknown) {
      return reply.status(400).send({ message: err instanceof Error ? err.message : "Rejected" });
    }
  });

  app.post("/approvals/:id/review", { preHandler: requireAdminOrInternal }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { decision?: "APPROVED" | "REJECTED"; notes?: string };
    if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
      return reply.status(400).send({ message: "decision must be APPROVED or REJECTED" });
    }
    try {
      const actor = (request.headers["x-user-id"] as string) || "admin";
      const approval = reviewPriceApproval(id, body.decision, actor, body.notes);
      return reply.send({ approval });
    } catch (err: unknown) {
      return reply.status(404).send({ message: err instanceof Error ? err.message : "Not found" });
    }
  });
}
