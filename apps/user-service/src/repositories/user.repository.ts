import { prisma } from "@repo/user-db";
import type { User, UserStatus, Prisma } from "@repo/user-db";

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        preferences: true,
        settings: true,
      },
    });
  }

  async findByAuthUserId(authUserId: string) {
    return prisma.user.findUnique({
      where: { authUserId },
      include: {
        profile: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        preferences: true,
        settings: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        preferences: true,
        settings: true,
      },
    });
  }

  async create(data: {
    authUserId: string;
    email: string;
    phone?: string | null;
    status?: UserStatus;
    firstName?: string | null;
    lastName?: string | null;
  }) {
    return prisma.user.create({
      data: {
        authUserId: data.authUserId,
        email: data.email,
        phone: data.phone,
        status: data.status || "ACTIVE",
        profile: {
          create: {
            firstName: data.firstName || null,
            lastName: data.lastName || null,
            displayName:
              data.firstName && data.lastName
                ? `${data.firstName} ${data.lastName}`
                : data.firstName || null,
          },
        },
        preferences: {
          create: {
            preferredLanguage: "en",
            currency: "USD",
            timezone: "UTC",
          },
        },
        settings: {
          create: {
            profileVisibility: "private",
            twoFactorPrompt: false,
            orderUpdatesEmail: true,
            orderUpdatesSms: false,
          },
        },
      },
      include: {
        profile: true,
        addresses: true,
        preferences: true,
        settings: true,
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        profile: true,
        addresses: true,
        preferences: true,
        settings: true,
      },
    });
  }

  async updateStatus(id: string, status: UserStatus) {
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async list(params: {
    skip?: number;
    take?: number;
    status?: UserStatus;
    search?: string;
  }) {
    const where: Prisma.UserWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        {
          profile: {
            OR: [
              { firstName: { contains: params.search, mode: "insensitive" } },
              { lastName: { contains: params.search, mode: "insensitive" } },
              { displayName: { contains: params.search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: params.skip || 0,
        take: params.take || 20,
        include: {
          profile: true,
          preferences: true,
          settings: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}

export const userRepository = new UserRepository();
