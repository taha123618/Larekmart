import type { FastifyInstance } from "fastify";
import { AdminTaxController } from "../controllers/admin-tax.controller.js";
import { requireAdminOrInternal } from "../middleware/auth.middleware.js";

export async function adminTaxRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.register(async (adminScope) => {
    adminScope.addHook("preHandler", requireAdminOrInternal);

    // Executive Overview
    adminScope.get(
      "/api/v1/admin/tax/overview",
      AdminTaxController.getOverview,
    );

    // Rule Management
    adminScope.get("/api/v1/admin/tax/rules", AdminTaxController.getRules);
    adminScope.post("/api/v1/admin/tax/rules", AdminTaxController.createRule);
    adminScope.patch(
      "/api/v1/admin/tax/rules/:ruleId",
      AdminTaxController.updateRule,
    );
    adminScope.post(
      "/api/v1/admin/tax/rules/:ruleId/activate",
      AdminTaxController.activateRule,
    );
    adminScope.delete(
      "/api/v1/admin/tax/rules/:ruleId",
      AdminTaxController.deleteRule,
    );

    // Master Data Mutators & Queries
    adminScope.post(
      "/api/v1/admin/tax/jurisdictions",
      AdminTaxController.createJurisdiction,
    );
    adminScope.post(
      "/api/v1/admin/tax/categories",
      AdminTaxController.createCategory,
    );
    adminScope.get(
      "/api/v1/admin/tax/exemptions",
      AdminTaxController.getExemptions,
    );
    adminScope.post(
      "/api/v1/admin/tax/exemptions",
      AdminTaxController.createExemption,
    );

    // Auditable Calculation Snapshots
    adminScope.get(
      "/api/v1/admin/tax/calculations",
      AdminTaxController.getCalculations,
    );
  });
}
