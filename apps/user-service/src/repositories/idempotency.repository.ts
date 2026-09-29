import { prisma } from "@repo/user-db";

export class IdempotencyRepository {
  async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return Boolean(existing);
  }

  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    await prisma.processedEvent.upsert({
      where: { eventId },
      create: { eventId, eventType },
      update: {},
    });
  }
}

export const idempotencyRepository = new IdempotencyRepository();
