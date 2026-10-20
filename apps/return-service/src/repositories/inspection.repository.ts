import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import { returnInspections, returnItems } from "../db/schema.js";

export interface RecordInspectionData {
  returnId: string;
  inspectorId: string;
  overallCondition: string;
  disposition: string;
  notes?: string;
  itemDispositions: Array<{
    returnItemId: string;
    receivedCondition: string;
    notes?: string;
  }>;
}

export class InspectionRepository {
  private db = getDb();

  async recordInspection(data: RecordInspectionData): Promise<string> {
    const inspectionId = uuidv4();

    await this.db.transaction(async (tx) => {
      // 1. Record main inspection
      await tx.insert(returnInspections).values({
        id: inspectionId,
        returnId: data.returnId,
        inspectorId: data.inspectorId,
        overallCondition: data.overallCondition,
        disposition: data.disposition,
        notes: data.notes || null,
        inspectedAt: new Date(),
      });

      // 2. Update each return item with inspected condition
      for (const item of data.itemDispositions) {
        await tx
          .update(returnItems)
          .set({
            condition: item.receivedCondition,
          })
          .where(eq(returnItems.id, item.returnItemId));
      }
    });

    return inspectionId;
  }

  async findByReturnId(returnId: string) {
    return this.db
      .select()
      .from(returnInspections)
      .where(eq(returnInspections.returnId, returnId));
  }
}

export const inspectionRepository = new InspectionRepository();
