import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { TicketPriority } from "@repo/support-db";

const DEFAULT_CATEGORIES = [
  {
    code: "ORDER_INQUIRY",
    name: "Order Inquiry",
    description:
      "Questions about order status, tracking, cancellation or item changes",
    defaultPriority: "MEDIUM",
  },
  {
    code: "PAYMENT_ISSUE",
    name: "Payment Issue",
    description:
      "Double charge, payment gateway failure, refund delay or checkout errors",
    defaultPriority: "HIGH",
  },
  {
    code: "RETURN_REFUND",
    name: "Return & Refund",
    description:
      "Return authorization, return shipping label, inspection disputes or refund status",
    defaultPriority: "MEDIUM",
  },
  {
    code: "PRODUCT_QUESTION",
    name: "Product & Inventory",
    description:
      "Product specifications, availability, stock inquiries or catalog inaccuracies",
    defaultPriority: "LOW",
  },
  {
    code: "SHIPPING_DELIVERY",
    name: "Shipping & Delivery",
    description:
      "Delayed shipments, lost packages, incorrect courier status or address correction",
    defaultPriority: "MEDIUM",
  },
  {
    code: "SELLER_DISPUTE",
    name: "Seller Dispute & Payouts",
    description:
      "Marketplace seller complaints, store balance, commission disputes or chargebacks",
    defaultPriority: "HIGH",
  },
  {
    code: "ACCOUNT_SECURITY",
    name: "Account & Security",
    description:
      "Compromised accounts, password reset, 2FA issues or suspicious login alerts",
    defaultPriority: "CRITICAL",
  },
  {
    code: "TECHNICAL_BUG",
    name: "Technical Bug",
    description:
      "Platform application error, mobile app crash, checkout glitch or UI defect",
    defaultPriority: "MEDIUM",
  },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaultCategories();
    } catch (err) {
      this.logger.warn(`Could not seed categories: ${(err as Error).message}`);
    }
  }

  async seedDefaultCategories() {
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await this.prisma.ticketCategory.findUnique({
        where: { code: cat.code },
      });
      if (!existing) {
        await this.prisma.ticketCategory.create({
          data: {
            code: cat.code,
            name: cat.name,
            description: cat.description,
            defaultPriority: cat.defaultPriority as TicketPriority,
            isActive: true,
          },
        });
        this.logger.log(`Seeded support category: ${cat.code}`);
      }
    }
  }

  async listCategories(activeOnly = true) {
    return this.prisma.ticketCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
      include: {
        slaPolicy: true,
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.ticketCategory.findUnique({
      where: { code },
      include: { slaPolicy: true },
    });
  }

  async findById(id: string) {
    return this.prisma.ticketCategory.findUnique({
      where: { id },
      include: { slaPolicy: true },
    });
  }
}
