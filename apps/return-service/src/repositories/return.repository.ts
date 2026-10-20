import { eq, and, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import {
  returns,
  returnItems,
  returnMedia,
  returnShipments,
  returnInspections,
  returnRefunds,
  returnStateTransitions,
} from "../db/schema.js";

export interface CreateReturnData {
  orderId: string;
  customerId: string;
  sellerId?: string;
  reasonCategory: string;
  customerComments?: string;
  subtotalRefund: string;
  taxRefund: string;
  shippingDeduction: string;
  totalRefund: string;
  currency: string;
  policyVersion: string;
  requiresManualReview: boolean;
  autoApproved: boolean;
  status: string;
  deliveredAt?: Date | null;
}

export interface ReturnItemData {
  orderItemId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: string;
  itemDiscount: string;
  proratedTax: string;
  refundSubtotal: string;
  reason: string;
  condition: string;
  customerNote?: string;
}

export class ReturnRepository {
  private db = getDb();

  async createReturn(
    data: CreateReturnData,
    items: ReturnItemData[],
    evidenceMedia?: Array<{ mediaId: string; url: string; mediaType?: string; caption?: string }>,
  ): Promise<string> {
    const returnId = uuidv4();

    await this.db.transaction(async (tx) => {
      // 1. Insert return
      await tx.insert(returns).values({
        id: returnId,
        orderId: data.orderId,
        customerId: data.customerId,
        sellerId: data.sellerId || null,
        status: data.status,
        reasonCategory: data.reasonCategory,
        customerComments: data.customerComments || null,
        subtotalRefund: data.subtotalRefund,
        taxRefund: data.taxRefund,
        shippingDeduction: data.shippingDeduction,
        totalRefund: data.totalRefund,
        currency: data.currency,
        policyVersion: data.policyVersion,
        requiresManualReview: data.requiresManualReview,
        autoApproved: data.autoApproved,
        deliveredAt: data.deliveredAt || null,
        approvedAt: data.autoApproved ? new Date() : null,
      });

      // 2. Insert return items
      for (const item of items) {
        await tx.insert(returnItems).values({
          id: uuidv4(),
          returnId,
          orderItemId: item.orderItemId,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemDiscount: item.itemDiscount,
          proratedTax: item.proratedTax,
          refundSubtotal: item.refundSubtotal,
          reason: item.reason,
          condition: item.condition,
          customerNote: item.customerNote || null,
        });
      }

      // 3. Insert initial evidence media if provided
      if (evidenceMedia && evidenceMedia.length > 0) {
        for (const media of evidenceMedia) {
          await tx.insert(returnMedia).values({
            id: uuidv4(),
            returnId,
            mediaId: media.mediaId,
            url: media.url,
            mediaType: media.mediaType || "PHOTO",
            uploaderRole: "CUSTOMER",
            caption: media.caption || null,
          });
        }
      }

      // 4. Initial transition record
      await tx.insert(returnStateTransitions).values({
        id: uuidv4(),
        returnId,
        previousState: "NONE",
        newState: data.status,
        actorId: data.customerId,
        actorRole: "CUSTOMER",
        reasonNote: data.customerComments || "Initial return request submitted",
      });
    });

    return returnId;
  }

  async findById(returnId: string) {
    const returnRows = await this.db
      .select()
      .from(returns)
      .where(eq(returns.id, returnId))
      .limit(1);

    const ret = returnRows[0];
    if (!ret) return null;

    const [items, media, shipments, inspections, refunds, transitions] =
      await Promise.all([
        this.db.select().from(returnItems).where(eq(returnItems.returnId, returnId)),
        this.db.select().from(returnMedia).where(eq(returnMedia.returnId, returnId)),
        this.db.select().from(returnShipments).where(eq(returnShipments.returnId, returnId)),
        this.db.select().from(returnInspections).where(eq(returnInspections.returnId, returnId)),
        this.db.select().from(returnRefunds).where(eq(returnRefunds.returnId, returnId)),
        this.db
          .select()
          .from(returnStateTransitions)
          .where(eq(returnStateTransitions.returnId, returnId))
          .orderBy(desc(returnStateTransitions.createdAt)),
      ]);

    return {
      ...ret,
      items,
      media,
      shipments,
      inspections,
      refunds,
      transitions,
    };
  }

  async findByOrderId(orderId: string) {
    return this.db
      .select()
      .from(returns)
      .where(eq(returns.orderId, orderId))
      .orderBy(desc(returns.createdAt));
  }

  async findByCustomerId(customerId: string, limit = 20, offset = 0) {
    return this.db
      .select()
      .from(returns)
      .where(eq(returns.customerId, customerId))
      .orderBy(desc(returns.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async listReturns(
    filters: { status?: string; sellerId?: string; requiresManualReview?: boolean },
    limit = 50,
    offset = 0,
  ) {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(returns.status, filters.status));
    }
    if (filters.sellerId) {
      conditions.push(eq(returns.sellerId, filters.sellerId));
    }
    if (filters.requiresManualReview !== undefined) {
      conditions.push(eq(returns.requiresManualReview, filters.requiresManualReview));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(returns)
      .where(whereClause)
      .orderBy(desc(returns.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateStatus(
    returnId: string,
    previousState: string,
    newState: string,
    actorId: string,
    actorRole: string,
    reasonNote?: string,
    extraUpdates?: Partial<typeof returns.$inferInsert>,
  ) {
    await this.db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: newState,
        ...extraUpdates,
      };

      if (newState === "APPROVED") {
        updateData.approvedAt = new Date();
      } else if (newState === "RECEIVED") {
        updateData.receivedAt = new Date();
      } else if (newState === "INSPECTION") {
        updateData.inspectedAt = new Date();
      } else if (newState === "COMPLETED") {
        updateData.completedAt = new Date();
      } else if (newState === "CANCELLED") {
        updateData.cancelledAt = new Date();
      }

      await tx.update(returns).set(updateData).where(eq(returns.id, returnId));

      await tx.insert(returnStateTransitions).values({
        id: uuidv4(),
        returnId,
        previousState,
        newState,
        actorId,
        actorRole,
        reasonNote: reasonNote || null,
      });
    });
  }

  async attachEvidence(
    returnId: string,
    mediaId: string,
    url: string,
    mediaType = "PHOTO",
    uploaderRole = "CUSTOMER",
    caption?: string,
  ) {
    const id = uuidv4();
    await this.db.insert(returnMedia).values({
      id,
      returnId,
      mediaId,
      url,
      mediaType,
      uploaderRole,
      caption: caption || null,
    });
    return id;
  }

  async countActiveReturnsByOrder(orderId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(returns)
      .where(
        and(
          eq(returns.orderId, orderId),
          sql`status NOT IN ('REJECTED', 'CANCELLED', 'COMPLETED')`,
        ),
      );
    return Number(result[0]?.count ?? 0);
  }
}

export const returnRepository = new ReturnRepository();
