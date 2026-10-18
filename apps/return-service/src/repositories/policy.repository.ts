import { eq, and } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import { returnPolicyVersions, returnReasons } from "../db/schema.js";

export class PolicyRepository {
  private db = getDb();

  async getActivePolicy() {
    const rows = await this.db
      .select()
      .from(returnPolicyVersions)
      .where(eq(returnPolicyVersions.isActive, true))
      .limit(1);
    return rows[0] || null;
  }

  async getReasonById(reasonId: string) {
    const rows = await this.db
      .select()
      .from(returnReasons)
      .where(eq(returnReasons.id, reasonId))
      .limit(1);
    return rows[0] || null;
  }

  async listActiveReasons() {
    return this.db
      .select()
      .from(returnReasons)
      .where(eq(returnReasons.isActive, true));
  }
}

export const policyRepository = new PolicyRepository();
