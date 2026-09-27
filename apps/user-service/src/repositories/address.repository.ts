import { prisma } from "@repo/user-db";
import type { CreateAddressInput, UpdateAddressInput } from "@repo/types";
import type { AddressType } from "@repo/user-db";

export class AddressRepository {
  async findManyByUserId(userId: string) {
    return prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async findById(id: string, userId: string) {
    return prisma.userAddress.findFirst({
      where: { id, userId },
    });
  }

  async create(userId: string, data: CreateAddressInput) {
    return prisma.$transaction(async (tx) => {
      const existingCount = await tx.userAddress.count({ where: { userId } });
      const makeDefault = data.isDefault || existingCount === 0;

      if (makeDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,
          type: (data.type as AddressType) || "SHIPPING",
          label: data.label || null,
          recipientName: data.recipientName,
          phone: data.phone,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || null,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country || "US",
          isDefault: makeDefault,
        },
      });
    });
  }

  async update(id: string, userId: string, data: UpdateAddressInput) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.update({
        where: { id },
        data: {
          ...(data.type !== undefined
            ? { type: data.type as AddressType }
            : {}),
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.recipientName !== undefined
            ? { recipientName: data.recipientName }
            : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.addressLine1 !== undefined
            ? { addressLine1: data.addressLine1 }
            : {}),
          ...(data.addressLine2 !== undefined
            ? { addressLine2: data.addressLine2 }
            : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.state !== undefined ? { state: data.state } : {}),
          ...(data.postalCode !== undefined
            ? { postalCode: data.postalCode }
            : {}),
          ...(data.country !== undefined ? { country: data.country } : {}),
          ...(data.isDefault !== undefined
            ? { isDefault: data.isDefault }
            : {}),
        },
      });
    });
  }

  async delete(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const address = await tx.userAddress.findFirst({
        where: { id, userId },
      });

      if (!address) {
        return null;
      }

      await tx.userAddress.delete({
        where: { id },
      });

      // If the deleted address was default, set the next most recent address as default
      if (address.isDefault) {
        const nextAddress = await tx.userAddress.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });

        if (nextAddress) {
          await tx.userAddress.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }

      return address;
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.userAddress.count({
      where: { userId },
    });
  }
}

export const addressRepository = new AddressRepository();
