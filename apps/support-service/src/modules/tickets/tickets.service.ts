import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { SlaService } from "../sla/sla.service.js";
import { CategoriesService } from "../categories/categories.service.js";
import { KafkaService } from "../../kafka/kafka.service.js";
import { RealtimeService } from "../../realtime/realtime.service.js";
import {
  SUPPORT_TOPICS,
  type CreateTicketInput,
  type UpdateTicketInput,
  type AddTicketMessageInput,
  type AssignTicketInput,
  type EscalateTicketInput,
  type TicketFilterInput,
  type SupportTicketCreatedEvent,
  type SupportTicketAssignedEvent,
  type SupportTicketUpdatedEvent,
  type SupportTicketResolvedEvent,
} from "@repo/types";

export interface ActorContext {
  userId: string;
  role: string;
  email?: string;
  isSeller?: boolean;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SlaService) private readonly slaService: SlaService,
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
    @Inject(KafkaService) private readonly kafkaService: KafkaService,
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
  ) {}

  private generateTicketNumber(): string {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    return `TKT-${year}-${randomSuffix}`;
  }

  async createTicket(input: CreateTicketInput, actor: ActorContext) {
    let category = await this.categoriesService.findByCode(input.categoryCode);
    if (!category) {
      // Auto-fallback to default category or create on-the-fly
      const allCategories = await this.categoriesService.listCategories();
      if (allCategories.length > 0) {
        category = allCategories[0]!;
      } else {
        throw new BadRequestException(
          `Category ${input.categoryCode} not found`,
        );
      }
    }

    const priority = input.priority || category.defaultPriority || "MEDIUM";
    const { firstResponseDueAt, resolutionDueAt, slaPolicyId } =
      await this.slaService.calculateDeadlines(priority, category.slaPolicyId);

    const ticketNumber = this.generateTicketNumber();

    const isActorAdmin = actor.role === "admin" || actor.role === "super_admin";
    // Non-admins cannot impersonate other customers or forge customer identity (SEC-29)
    const customerId = isActorAdmin
      ? input.customerId || (actor.isSeller ? null : actor.userId)
      : actor.isSeller
        ? null
        : actor.userId;
    const customerEmail = isActorAdmin
      ? input.customerEmail || actor.email
      : actor.email || input.customerEmail;
    const sellerId = isActorAdmin
      ? input.sellerId || (actor.isSeller ? actor.userId : null)
      : actor.isSeller
        ? actor.userId
        : input.sellerId || null;

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        subject: input.subject,
        description: input.description,
        status: "OPEN",
        priority,
        categoryId: category.id,
        slaPolicyId,
        source:
          input.source ||
          (isActorAdmin ? "ADMIN" : actor.isSeller ? "SELLER" : "CUSTOMER"),
        customerId,
        customerEmail,
        customerPhone: input.customerPhone,
        sellerId,
        orderId: input.orderId,
        paymentId: input.paymentId,
        returnId: input.returnId,
        chatSessionId: input.chatSessionId,
        firstResponseDueAt,
        resolutionDueAt,
        metadata: input.metadata || {},
        messages: {
          create: {
            senderId: actor.userId,
            senderRole: isActorAdmin
              ? "ADMIN"
              : actor.isSeller
                ? "SELLER"
                : "CUSTOMER",
            senderName: actor.email || actor.userId,
            isInternalNote: false,
            content: input.description,
            mediaAttachments: (input.attachments as any) || [],
          },
        },
        history: {
          create: {
            actorId: actor.userId,
            actorRole: isActorAdmin
              ? "ADMIN"
              : actor.isSeller
                ? "SELLER"
                : "CUSTOMER",
            action: "CREATED",
            toState: {
              status: "OPEN",
              priority,
              categoryCode: category.code,
            },
          },
        },
      },
      include: {
        category: true,
        slaPolicy: true,
        messages: true,
      },
    });

    // Publish Kafka Event
    const event: SupportTicketCreatedEvent = {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      categoryCode: category.code,
      priority: ticket.priority as any,
      status: ticket.status as any,
      source: ticket.source as any,
      customerId: ticket.customerId,
      customerEmail: ticket.customerEmail,
      sellerId: ticket.sellerId,
      orderId: ticket.orderId,
      paymentId: ticket.paymentId,
      returnId: ticket.returnId,
      timestamp: new Date().toISOString(),
    };
    await this.kafkaService.emitEvent(SUPPORT_TOPICS.TICKET_CREATED, event);

    // Socket.IO Broadcast
    this.realtimeService.notifyTicketCreated(ticket);

    return ticket;
  }

  async listTickets(filter: TicketFilterInput, actor: ActorContext) {
    const isAdmin = actor.role === "admin" || actor.role === "super_admin";
    const where: any = {};

    if (!isAdmin) {
      if (actor.isSeller) {
        where.sellerId = actor.userId;
      } else {
        where.customerId = actor.userId;
      }
    } else {
      if (filter.customerId) where.customerId = filter.customerId;
      if (filter.sellerId) where.sellerId = filter.sellerId;
    }

    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.assignedAgentId) where.assignedAgentId = filter.assignedAgentId;
    if (filter.isEscalated !== undefined)
      where.isEscalated = filter.isEscalated;

    if (filter.categoryCode) {
      const category = await this.categoriesService.findByCode(
        filter.categoryCode,
      );
      if (category) {
        where.categoryId = category.id;
      }
    }

    if (filter.search) {
      where.OR = [
        { ticketNumber: { contains: filter.search, mode: "insensitive" } },
        { subject: { contains: filter.search, mode: "insensitive" } },
        { customerEmail: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        take: filter.limit || 20,
        skip: filter.offset || 0,
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          slaPolicy: true,
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    return {
      total,
      limit: filter.limit || 20,
      offset: filter.offset || 0,
      items,
    };
  }

  async getTicketById(id: string, actor: ActorContext) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }],
      },
      include: {
        category: true,
        slaPolicy: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
        assignments: {
          orderBy: { assignedAt: "desc" },
        },
        history: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const isAdmin = actor.role === "admin" || actor.role === "super_admin";
    if (!isAdmin) {
      if (actor.isSeller && ticket.sellerId !== actor.userId) {
        throw new ForbiddenException("Access denied to this ticket");
      }
      if (!actor.isSeller && ticket.customerId !== actor.userId) {
        throw new ForbiddenException("Access denied to this ticket");
      }
    }

    // Role-based privacy: redact internal notes for non-admins
    if (!isAdmin) {
      ticket.messages = ticket.messages.filter((m) => !m.isInternalNote);
    }

    return ticket;
  }

  async addMessage(
    id: string,
    input: AddTicketMessageInput,
    actor: ActorContext,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }],
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const isAdmin = actor.role === "admin" || actor.role === "super_admin";
    if (!isAdmin) {
      if (actor.isSeller && ticket.sellerId !== actor.userId) {
        throw new ForbiddenException("Access denied to this ticket");
      }
      if (!actor.isSeller && ticket.customerId !== actor.userId) {
        throw new ForbiddenException("Access denied to this ticket");
      }
      if (input.isInternalNote) {
        throw new ForbiddenException(
          "Only staff and administrators can post internal notes",
        );
      }
    }

    const senderRole = isAdmin
      ? "ADMIN"
      : actor.isSeller
        ? "SELLER"
        : "CUSTOMER";
    const isInternalNote = Boolean(input.isInternalNote && isAdmin);

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: actor.userId,
        senderRole,
        senderName: actor.email || actor.userId,
        isInternalNote,
        content: input.content,
        mediaAttachments: (input.attachments as any) || [],
      },
    });

    // Update ticket state transitions
    const updates: any = {};
    if (!isInternalNote) {
      if (isAdmin) {
        if (!ticket.firstResponseAt) {
          updates.firstResponseAt = new Date();
        }
        if (ticket.status === "OPEN" || ticket.status === "WAITING_ON_AGENT") {
          updates.status = "WAITING_ON_CUSTOMER";
        }
      } else {
        if (ticket.status === "WAITING_ON_CUSTOMER") {
          updates.status = "WAITING_ON_AGENT";
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: updates,
      });
    }

    // Record History
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        actorRole: senderRole,
        action: isInternalNote ? "INTERNAL_NOTE_ADDED" : "MESSAGE_ADDED",
        toState: {
          messageId: message.id,
          isInternalNote,
        },
      },
    });

    // Socket.IO Realtime update
    this.realtimeService.notifyTicketMessage(ticket.id, message);

    return message;
  }

  async updateTicket(
    id: string,
    input: UpdateTicketInput,
    actor: ActorContext,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }],
      },
      include: {
        slaPolicy: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const isAdmin = actor.role === "admin" || actor.role === "super_admin";
    if (!isAdmin) {
      if (
        ticket.customerId !== actor.userId &&
        ticket.sellerId !== actor.userId
      ) {
        throw new ForbiddenException("Access denied to update this ticket");
      }
      // Non-admins can only mark a ticket resolved/closed (SEC-30)
      if (input.priority || input.categoryCode) {
        throw new ForbiddenException(
          "Only admins can modify ticket priority or category",
        );
      }
      if (input.metadata) {
        throw new ForbiddenException(
          "Only administrators can modify ticket metadata",
        );
      }
      if (
        input.status &&
        input.status !== "RESOLVED" &&
        input.status !== "CLOSED"
      ) {
        throw new ForbiddenException(
          "Non-administrators can only transition tickets to RESOLVED or CLOSED",
        );
      }
    }

    const data: any = {};
    const fromState: any = {
      status: ticket.status,
      priority: ticket.priority,
    };
    const toState: any = {};

    if (input.status) {
      data.status = input.status;
      toState.status = input.status;

      if (input.status === "RESOLVED" && ticket.status !== "RESOLVED") {
        data.resolvedAt = new Date();
        const durationMins = Math.round(
          (data.resolvedAt.getTime() - ticket.createdAt.getTime()) /
            (60 * 1000),
        );
        const slaBreached = ticket.resolutionDueAt
          ? data.resolvedAt > ticket.resolutionDueAt
          : false;

        const resolvedEvent: SupportTicketResolvedEvent = {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          resolvedBy: actor.userId,
          resolutionTimeMinutes: durationMins,
          slaBreached,
          timestamp: new Date().toISOString(),
        };
        await this.kafkaService.emitEvent(
          SUPPORT_TOPICS.TICKET_RESOLVED,
          resolvedEvent,
        );
        this.realtimeService.notifyTicketResolved({ ...ticket, ...data });
      } else if (input.status === "CLOSED" && ticket.status !== "CLOSED") {
        data.closedAt = new Date();
      }
    }

    if (input.priority) {
      data.priority = input.priority;
      toState.priority = input.priority;
    }

    if (input.metadata) {
      data.metadata = { ...(ticket.metadata as any), ...input.metadata };
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data,
      include: {
        category: true,
        slaPolicy: true,
      },
    });

    // Record History
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        actorRole: isAdmin ? "ADMIN" : actor.isSeller ? "SELLER" : "CUSTOMER",
        action: "STATUS_UPDATED",
        fromState,
        toState,
      },
    });

    // Emit Kafka event
    const updateEvent: SupportTicketUpdatedEvent = {
      ticketId: updated.id,
      ticketNumber: updated.ticketNumber,
      previousStatus: fromState.status,
      newStatus: updated.status as any,
      previousPriority: fromState.priority,
      newPriority: updated.priority as any,
      updatedBy: actor.userId,
      timestamp: new Date().toISOString(),
    };
    await this.kafkaService.emitEvent(
      SUPPORT_TOPICS.TICKET_UPDATED,
      updateEvent,
    );

    // Socket.IO
    this.realtimeService.notifyTicketUpdated(updated);

    return updated;
  }

  async assignTicket(
    id: string,
    input: AssignTicketInput,
    actor: ActorContext,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }],
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedAgentId: input.assignedTo,
        assignedTeam: input.assignedTeam || "TIER_1",
        status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
      },
    });

    const assignment = await this.prisma.ticketAssignment.create({
      data: {
        ticketId: ticket.id,
        assignedBy: actor.userId,
        assignedTo: input.assignedTo,
        assignedTeam: input.assignedTeam || "TIER_1",
        status: "ACTIVE",
        notes: input.notes,
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        actorRole: "ADMIN",
        action: "ASSIGNED",
        toState: {
          assignedTo: input.assignedTo,
          assignedTeam: input.assignedTeam || "TIER_1",
          notes: input.notes,
        },
      },
    });

    // Publish Kafka Event
    const event: SupportTicketAssignedEvent = {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      assignedBy: actor.userId,
      assignedTo: input.assignedTo,
      assignedTeam: (input.assignedTeam as any) || "TIER_1",
      timestamp: new Date().toISOString(),
    };
    await this.kafkaService.emitEvent(SUPPORT_TOPICS.TICKET_ASSIGNED, event);

    // Socket.IO
    this.realtimeService.notifyTicketAssigned(assignment);
    this.realtimeService.notifyTicketUpdated(updated);

    return { ticket: updated, assignment };
  }

  async escalateTicket(
    id: string,
    input: EscalateTicketInput,
    actor: ActorContext,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }],
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const priority = input.priority || "URGENT";
    const { resolutionDueAt } =
      await this.slaService.calculateDeadlines(priority);

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalationReason: input.escalationReason,
        assignedTeam: input.targetTeam || "ESCALATIONS",
        status: "ESCALATED",
        priority,
        resolutionDueAt,
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        actorRole: "ADMIN",
        action: "ESCALATED",
        toState: {
          isEscalated: true,
          targetTeam: input.targetTeam || "ESCALATIONS",
          escalationReason: input.escalationReason,
          priority,
        },
      },
    });

    // Kafka Event
    const updateEvent: SupportTicketUpdatedEvent = {
      ticketId: updated.id,
      ticketNumber: updated.ticketNumber,
      previousStatus: ticket.status as any,
      newStatus: "ESCALATED",
      previousPriority: ticket.priority as any,
      newPriority: priority as any,
      updatedBy: actor.userId,
      timestamp: new Date().toISOString(),
    };
    await this.kafkaService.emitEvent(
      SUPPORT_TOPICS.TICKET_UPDATED,
      updateEvent,
    );

    // Socket.IO
    this.realtimeService.notifyTicketUpdated(updated);

    return updated;
  }

  async getResolutionAnalytics() {
    const [
      totalTickets,
      statusGroups,
      priorityGroups,
      teamGroups,
      resolvedTickets,
    ] = await Promise.all([
      this.prisma.ticket.count(),
      this.prisma.ticket.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      this.prisma.ticket.groupBy({
        by: ["priority"],
        _count: { priority: true },
      }),
      this.prisma.ticket.groupBy({
        by: ["assignedTeam"],
        where: { assignedTeam: { not: null } },
        _count: { assignedTeam: true },
      }),
      this.prisma.ticket.findMany({
        where: {
          status: "RESOLVED",
          resolvedAt: { not: null },
        },
        select: {
          createdAt: true,
          firstResponseAt: true,
          resolvedAt: true,
          resolutionDueAt: true,
          assignedAgentId: true,
        },
      }),
    ]);

    let totalResolutionMinutes = 0;
    let totalFirstResponseMinutes = 0;
    let firstResponseCount = 0;
    let breachedSlaCount = 0;

    for (const t of resolvedTickets) {
      if (t.resolvedAt) {
        const resTime =
          (t.resolvedAt.getTime() - t.createdAt.getTime()) / (60 * 1000);
        totalResolutionMinutes += resTime;
        if (t.resolutionDueAt && t.resolvedAt > t.resolutionDueAt) {
          breachedSlaCount++;
        }
      }
      if (t.firstResponseAt) {
        const frTime =
          (t.firstResponseAt.getTime() - t.createdAt.getTime()) / (60 * 1000);
        totalFirstResponseMinutes += frTime;
        firstResponseCount++;
      }
    }

    const avgResolutionTimeMinutes =
      resolvedTickets.length > 0
        ? Math.round(totalResolutionMinutes / resolvedTickets.length)
        : 0;

    const avgFirstResponseTimeMinutes =
      firstResponseCount > 0
        ? Math.round(totalFirstResponseMinutes / firstResponseCount)
        : 0;

    const slaBreachRatePercentage =
      resolvedTickets.length > 0
        ? Math.round((breachedSlaCount / resolvedTickets.length) * 100)
        : 0;

    // Agent active workload
    const agentWorkload = await this.prisma.ticket.groupBy({
      by: ["assignedAgentId"],
      where: {
        assignedAgentId: { not: null },
        status: {
          in: ["OPEN", "IN_PROGRESS", "WAITING_ON_AGENT", "ESCALATED"],
        },
      },
      _count: { assignedAgentId: true },
    });

    return {
      totalTickets,
      statusBreakdown: Object.fromEntries(
        statusGroups.map((s) => [s.status, s._count.status]),
      ),
      priorityBreakdown: Object.fromEntries(
        priorityGroups.map((p) => [p.priority, p._count.priority]),
      ),
      teamBreakdown: Object.fromEntries(
        teamGroups.map((t) => [t.assignedTeam!, t._count.assignedTeam]),
      ),
      slaMetrics: {
        totalResolved: resolvedTickets.length,
        breachedCount: breachedSlaCount,
        slaBreachRatePercentage,
        avgFirstResponseTimeMinutes,
        avgResolutionTimeMinutes,
      },
      agentWorkload: agentWorkload.map((w) => ({
        agentId: w.assignedAgentId,
        activeTickets: w._count.assignedAgentId,
      })),
    };
  }
}
