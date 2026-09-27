import { prisma } from "@repo/user-db";
import type { UpdateProfileInput } from "@repo/types";
import type { Prisma } from "@repo/user-db";

export class ProfileRepository {
  async findByUserId(userId: string) {
    return prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: UpdateProfileInput) {
    const updateData: Prisma.UserProfileUpdateInput = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata as Prisma.InputJsonValue;
    }

    return prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        displayName: data.displayName || null,
        avatarUrl: data.avatarUrl || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender || null,
        bio: data.bio || null,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
      update: updateData,
    });
  }
}

export const profileRepository = new ProfileRepository();
