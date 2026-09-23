import { prisma, ShipmentStatus } from "@repo/shipping-db";
import type { CreateShipmentRequest } from "@repo/types";

export class ShipmentRepository {
  static async createShipmentWithItems(
    data: CreateShipmentRequest & {
      trackingNumber?: string | null;
      status?: ShipmentStatus;
      estimatedDeliveryAt?: Date | null;
    },
  ) {
    return prisma.shipment.create({
      data: {
        orderId: data.orderId,
        userId: data.userId ?? null,
        carrier: data.carrier,
        serviceType: data.serviceType ?? "standard",
        trackingNumber: data.trackingNumber ?? null,
        status: data.status ?? ShipmentStatus.PENDING,
        shippingAddress: data.shippingAddress as object,
        shippingRateAmount: Math.round(data.shippingRateAmount ?? 0),
        currency: data.currency ?? "PKR",
        isCod: Boolean(data.isCod),
        codAmount: data.codAmount ? Math.round(data.codAmount) : null,
        codFee: data.codFee ? Math.round(data.codFee) : 0,
        codStatus: (data as any).codStatus ?? (data.isCod ? "PENDING_COLLECTION" : null),
        estimatedDeliveryAt: data.estimatedDeliveryAt ?? null,
        metadata: (data.metadata as object) ?? null,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: Math.round(item.price),
            weight: item.weight ?? null,
            sku: item.sku ?? null,
          })),
        },
        packages: {
          create:
            data.packages?.map((pkg) => ({
              weight: pkg.weight,
              length: pkg.length ?? null,
              width: pkg.width ?? null,
              height: pkg.height ?? null,
              packageType: pkg.packageType ?? "box",
            })) ?? [],
        },
      },
      include: {
        items: true,
        packages: true,
        labels: true,
        trackingEvents: true,
      },
    });
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    carrier?: string;
    status?: ShipmentStatus;
    search?: string;
    isCod?: boolean;
    codStatus?: string;
  } = {}) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params.carrier) {
      where.carrier = params.carrier;
    }
    if (params.status) {
      where.status = params.status;
    }
    if (params.isCod !== undefined) {
      where.isCod = params.isCod;
    }
    if (params.codStatus) {
      where.codStatus = params.codStatus;
    }
    if (params.search) {
      where.OR = [
        { trackingNumber: { contains: params.search, mode: "insensitive" } },
        { orderId: { contains: params.search, mode: "insensitive" } },
        { userId: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          packages: true,
          labels: true,
          trackingEvents: {
            orderBy: { occurredAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.shipment.count({ where }),
    ]);

    return {
      shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findById(id: string) {
    return prisma.shipment.findUnique({
      where: { id },
      include: {
        items: true,
        packages: true,
        labels: true,
        trackingEvents: {
          orderBy: { occurredAt: "asc" },
        },
        deliveryAttempts: true,
      },
    });
  }

  static async findByOrderId(orderId: string) {
    return prisma.shipment.findFirst({
      where: { orderId },
      include: {
        items: true,
        packages: true,
        labels: true,
        trackingEvents: {
          orderBy: { occurredAt: "asc" },
        },
      },
    });
  }

  static async findByTrackingNumber(trackingNumber: string) {
    return prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        items: true,
        packages: true,
        labels: true,
        trackingEvents: {
          orderBy: { occurredAt: "asc" },
        },
      },
    });
  }

  static async updateStatus(
    id: string,
    status: ShipmentStatus,
    extra: {
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
      trackingNumber?: string | null;
      estimatedDeliveryAt?: Date | null;
      codStatus?: string | null;
    } = {},
  ) {
    return prisma.shipment.update({
      where: { id },
      data: {
        status,
        ...(extra.shippedAt !== undefined && { shippedAt: extra.shippedAt }),
        ...(extra.deliveredAt !== undefined && {
          deliveredAt: extra.deliveredAt,
        }),
        ...(extra.trackingNumber !== undefined && {
          trackingNumber: extra.trackingNumber,
        }),
        ...(extra.estimatedDeliveryAt !== undefined && {
          estimatedDeliveryAt: extra.estimatedDeliveryAt,
        }),
        ...(extra.codStatus !== undefined && {
          codStatus: extra.codStatus,
        }),
      },
      include: {
        items: true,
        packages: true,
        labels: true,
        trackingEvents: true,
      },
    });
  }

  static async updateCodStatus(id: string, codStatus: string) {
    return prisma.shipment.update({
      where: { id },
      data: { codStatus },
    });
  }

  static async addTrackingEvent(data: {
    shipmentId: string;
    status: ShipmentStatus;
    description: string;
    location?: string | null;
    occurredAt?: Date;
    source?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.trackingEvent.create({
      data: {
        shipmentId: data.shipmentId,
        status: data.status,
        description: data.description,
        location: data.location ?? null,
        occurredAt: data.occurredAt ?? new Date(),
        source: data.source ?? "manual",
        metadata: (data.metadata as object) ?? null,
      },
    });
  }

  static async addLabel(data: {
    shipmentId: string;
    carrier: string;
    trackingNumber: string;
    format: string;
    labelUrl: string;
    cost?: number | null;
  }) {
    return prisma.shippingLabel.create({
      data: {
        shipmentId: data.shipmentId,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        format: data.format,
        labelUrl: data.labelUrl,
        cost: data.cost ?? null,
      },
    });
  }

  static async getActiveShippingMethods() {
    return prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { baseRate: "asc" },
    });
  }

  static async seedDefaultMethodsIfEmpty() {
    const count = await prisma.shippingMethod.count();
    if (count === 0) {
      await prisma.shippingMethod.createMany({
        data: [
          {
            name: "Standard Ground Delivery",
            code: "std_custom",
            carrier: "custom",
            description: "Reliable city-wide delivery in 2-4 business days",
            baseRate: 200,
            estimatedDaysMin: 2,
            estimatedDaysMax: 4,
            isActive: true,
          },
          {
            name: "TCS Express Delivery",
            code: "exp_tcs",
            carrier: "tcs",
            description: "Nationwide express courier dispatch via TCS",
            baseRate: 250,
            estimatedDaysMin: 1,
            estimatedDaysMax: 3,
            isActive: true,
          },
          {
            name: "Leopards Yellow Box",
            code: "exp_leopards",
            carrier: "leopards",
            description: "Secure tracked delivery across Pakistan",
            baseRate: 220,
            estimatedDaysMin: 2,
            estimatedDaysMax: 4,
            isActive: true,
          },
          {
            name: "DHL Express Worldwide",
            code: "intl_dhl",
            carrier: "dhl",
            description: "Fast global air delivery for international orders",
            baseRate: 3500,
            estimatedDaysMin: 3,
            estimatedDaysMax: 5,
            isActive: true,
          },
        ],
      });
    }
  }
}
