import type { FastifyInstance } from "fastify";
import { AdminTaxController } from "../controllers/admin-tax.controller.js";
import { requireAdminOrInternal } from "../middleware/auth.middleware.js";

export async function adminTaxRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.register(async (adminScope) => {
    adminScope.addHook("preHandler", requireAdminOrInternal);

    // Rule Management
    adminScope.post("/api/v1/admin/tax/rules", AdminTaxController.createRule);
    adminScope.patch(
      "/api/v1/admin/tax/rules/:ruleId",
      AdminTaxController.updateRule,
    );
    adminScope.post(
      "/api/v1/admin/tax/rules/:ruleId/activate",
      AdminTaxController.activateRule,
    );

    // Master Data Mutators
    adminScope.post(
      "/api/v1/admin/tax/jurisdictions",
      AdminTaxController.createJurisdiction,
    );
    adminScope.post(
      "/api/v1/admin/tax/categories",
      AdminTaxController.createCategory,
    );
    adminScope.post(
      "/api/v1/admin/tax/exemptions",
      AdminTaxController.createExemption,
    );
  });
}
