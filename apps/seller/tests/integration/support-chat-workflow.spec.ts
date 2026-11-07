import { describe, it, expect } from "vitest";

interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
  subject: string;
  createdAt: string;
  slaDueAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "BUYER" | "SELLER";
  content: string;
  isRead: boolean;
  createdAt: string;
}

function calculateSlaDueDate(priority: SupportTicket["priority"], createdAt: Date = new Date()): Date {
  const hoursMap: Record<SupportTicket["priority"], number> = {
    URGENT: 4,
    HIGH: 12,
    MEDIUM: 24,
    LOW: 48,
  };
  const hours = hoursMap[priority];
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

function isTicketSlaBreached(ticket: SupportTicket, currentDate: Date = new Date()): boolean {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    return false;
  }
  return new Date(ticket.slaDueAt) < currentDate;
}

function computeUnreadMessagesCount(messages: ChatMessage[], recipientId: string): number {
  return messages.filter((m) => m.senderId !== recipientId && !m.isRead).length;
}

function markConversationAsRead(messages: ChatMessage[], readerId: string): ChatMessage[] {
  return messages.map((m) => {
    if (m.senderId !== readerId) {
      return { ...m, isRead: true };
    }
    return m;
  });
}

describe("Support Tickets & Live Chat Messaging (Integration)", () => {
  describe("Support Ticket SLA Lifecycle", () => {
    it("assigns SLA resolution deadlines according to ticket priority", () => {
      const baseDate = new Date("2026-07-01T10:00:00Z");
      const urgentSla = calculateSlaDueDate("URGENT", baseDate);
      const mediumSla = calculateSlaDueDate("MEDIUM", baseDate);

      // Urgent is 4h later -> 14:00
      expect(urgentSla.toISOString()).toBe("2026-07-01T14:00:00.000Z");
      // Medium is 24h later -> next day 10:00
      expect(mediumSla.toISOString()).toBe("2026-07-02T10:00:00.000Z");
    });

    it("accurately detects SLA deadline breach for unresolved tickets", () => {
      const ticket: SupportTicket = {
        id: "tkt_101",
        ticketNumber: "SUP-2026-00101",
        userId: "usr_seller_1",
        category: "PAYOUT_DISPUTE",
        priority: "HIGH",
        status: "OPEN",
        subject: "Delayed settlement batch",
        createdAt: "2026-07-01T08:00:00Z",
        slaDueAt: "2026-07-01T20:00:00Z", // 20:00 on July 1
      };

      // Check at 18:00 (before deadline)
      expect(isTicketSlaBreached(ticket, new Date("2026-07-01T18:00:00Z"))).toBe(false);

      // Check at 21:00 (past deadline)
      expect(isTicketSlaBreached(ticket, new Date("2026-07-01T21:00:00Z"))).toBe(true);

      // Resolved ticket is never considered breached
      const resolvedTicket: SupportTicket = { ...ticket, status: "RESOLVED" };
      expect(isTicketSlaBreached(resolvedTicket, new Date("2026-07-01T22:00:00Z"))).toBe(false);
    });
  });

  describe("Real-Time Chat Unread Tracking & Read Receipts", () => {
    it("tracks unread message counts and applies read receipts upon reading", () => {
      const sellerId = "usr_seller_1";
      const buyerId = "usr_buyer_99";

      let messages: ChatMessage[] = [
        {
          id: "msg_1",
          conversationId: "conv_1",
          senderId: buyerId,
          senderRole: "BUYER",
          content: "Hi! Is this item in stock?",
          isRead: true,
          createdAt: "2026-07-01T10:00:00Z",
        },
        {
          id: "msg_2",
          conversationId: "conv_1",
          senderId: sellerId,
          senderRole: "SELLER",
          content: "Yes, ready to ship today!",
          isRead: true,
          createdAt: "2026-07-01T10:02:00Z",
        },
        {
          id: "msg_3",
          conversationId: "conv_1",
          senderId: buyerId,
          senderRole: "BUYER",
          content: "Great, does it come with a 1-year warranty?",
          isRead: false,
          createdAt: "2026-07-01T10:05:00Z",
        },
        {
          id: "msg_4",
          conversationId: "conv_1",
          senderId: buyerId,
          senderRole: "BUYER",
          content: "Also what carrier do you use?",
          isRead: false,
          createdAt: "2026-07-01T10:06:00Z",
        },
      ];

      // Seller has 2 unread messages from buyer
      expect(computeUnreadMessagesCount(messages, sellerId)).toBe(2);

      // Seller opens conversation and reads messages
      messages = markConversationAsRead(messages, sellerId);

      // Unread count drops to 0
      expect(computeUnreadMessagesCount(messages, sellerId)).toBe(0);
      expect(messages.every((m) => m.isRead)).toBe(true);
    });
  });
});
