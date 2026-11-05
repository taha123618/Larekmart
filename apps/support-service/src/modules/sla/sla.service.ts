import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { TicketPriority } from "@repo/support-db";

const DEFAULT_SLA_POLICIES = [
  {
    name: "Critical Priority SLA",
    description: "Account takeovers, massive outages, severe security breaches",
    priority: "CRITICAL",
    firstResponseTimeMinutes: 15,
    resolutionTimeMinutes: 120,
    escalationTier: 3,
  },
  {
    name: "Urgent Priority SLA",
    description: "Payment gateway down, immediate order fulfillment blockers",
    priority: "URGENT",
    firstResponseTimeMinutes: 30,
    resolutionTimeMinutes: 240,
    escalationTier: 2,
  },
  {
    name: "High Priority SLA",
    description:
      "Disputed chargebacks, damaged high-value shipments, seller balance issues",
    priority: "HIGH",
    firstResponseTimeMinutes: 60,
    resolutionTimeMinutes: 480,
    escalationTier: 2,
  },
  {
    name: "Medium Priority SLA",
    description:
      "Standard returns, tracking inquiries, general order questions",
    priority: "MEDIUM",
    firstResponseTimeMinutes: 120,
    resolutionTimeMinutes: 1440,
    escalationTier: 1,
  },
  {
    name: "Low Priority SLA",
    description: "General questions, feature feedback, non-blocking inquiries",
    priority: "LOW",
    firstResponseTimeMinutes: 240,
    resolutionTimeMinutes: 2880,
    escalationTier: 1,
  },
];

@Injectable()
export class SlaService implements OnModuleInit {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaultPolicies();
    } catch (err) {
      this.logger.warn(
        `Could not seed SLA policies: ${(err as Error).message}`,
      );
    }
  }

  async seedDefaultPolicies() {
    for (const policy of DEFAULT_SLA_POLICIES) {
      const existing = await this.prisma.ticketSlaPolicy.findFirst({
        where: { priority: policy.priority as TicketPriority },
      });
      if (!existing) {
        await this.prisma.ticketSlaPolicy.create({
          data: {
            name: policy.name,
            description: policy.description,
            priority: policy.priority as TicketPriority,
            firstResponseTimeMinutes: policy.firstResponseTimeMinutes,
            resolutionTimeMinutes: policy.resolutionTimeMinutes,
            escalationTier: policy.escalationTier,
            isActive: true,
          },
        });
        this.logger.log(`Seeded SLA policy for priority: ${policy.priority}`);
      }
    }
  }

  async listPolicies() {
    return this.prisma.ticketSlaPolicy.findMany({
      orderBy: { firstResponseTimeMinutes: "asc" },
    });
  }

  async getPolicyForPriority(priority: string) {
    return this.prisma.ticketSlaPolicy.findFirst({
      where: { priority: priority as TicketPriority, isActive: true },
    });
  }

  async calculateDeadlines(priority: string, policyId?: string | null) {
    let policy = null;
    if (policyId) {
      policy = await this.prisma.ticketSlaPolicy.findUnique({
        where: { id: policyId },
      });
    }

    if (!policy) {
      policy = await this.getPolicyForPriority(priority);
    }

    const now = Date.now();
    const firstResponseMins = policy?.firstResponseTimeMinutes ?? 120;
    const resolutionMins = policy?.resolutionTimeMinutes ?? 1440;

    const firstResponseDueAt = new Date(now + firstResponseMins * 60 * 1000);
    const resolutionDueAt = new Date(now + resolutionMins * 60 * 1000);

    return {
      firstResponseDueAt,
      resolutionDueAt,
      slaPolicyId: policy?.id ?? null,
    };
  }
}
