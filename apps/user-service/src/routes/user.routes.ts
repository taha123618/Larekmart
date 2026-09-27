import type { FastifyPluginAsync } from "fastify";
import { shouldBeUser, shouldBeAdmin } from "../middleware/auth.middleware.js";
import { userController } from "../controllers/user.controller.js";
import { profileController } from "../controllers/profile.controller.js";
import { addressController } from "../controllers/address.controller.js";
import { preferenceController } from "../controllers/preference.controller.js";
import { settingsController } from "../controllers/settings.controller.js";

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================
  // Customer "Me" Domain Routes
  // ==========================================

  // Account endpoints
  fastify.get(
    "/me",
    { preHandler: [shouldBeUser] },
    userController.getMe.bind(userController),
  );
  fastify.patch(
    "/me",
    { preHandler: [shouldBeUser] },
    userController.updateMe.bind(userController),
  );
  fastify.delete(
    "/me",
    { preHandler: [shouldBeUser] },
    userController.deleteMe.bind(userController),
  );

  // Profile endpoints
  fastify.get(
    "/me/profile",
    { preHandler: [shouldBeUser] },
    profileController.getMyProfile.bind(profileController),
  );
  fastify.patch(
    "/me/profile",
    { preHandler: [shouldBeUser] },
    profileController.updateMyProfile.bind(profileController),
  );

  // Address endpoints
  fastify.get(
    "/me/addresses",
    { preHandler: [shouldBeUser] },
    addressController.getMyAddresses.bind(addressController),
  );
  fastify.post(
    "/me/addresses",
    { preHandler: [shouldBeUser] },
    addressController.createMyAddress.bind(addressController),
  );
  fastify.get(
    "/me/addresses/:addressId",
    { preHandler: [shouldBeUser] },
    addressController.getMyAddress.bind(addressController),
  );
  fastify.patch(
    "/me/addresses/:addressId",
    { preHandler: [shouldBeUser] },
    addressController.updateMyAddress.bind(addressController),
  );
  fastify.delete(
    "/me/addresses/:addressId",
    { preHandler: [shouldBeUser] },
    addressController.deleteMyAddress.bind(addressController),
  );

  // Preferences endpoints
  fastify.get(
    "/me/preferences",
    { preHandler: [shouldBeUser] },
    preferenceController.getMyPreferences.bind(preferenceController),
  );
  fastify.patch(
    "/me/preferences",
    { preHandler: [shouldBeUser] },
    preferenceController.updateMyPreferences.bind(preferenceController),
  );

  // Settings endpoints
  fastify.get(
    "/me/settings",
    { preHandler: [shouldBeUser] },
    settingsController.getMySettings.bind(settingsController),
  );
  fastify.patch(
    "/me/settings",
    { preHandler: [shouldBeUser] },
    settingsController.updateMySettings.bind(settingsController),
  );

  // ==========================================
  // Administrative Endpoints
  // ==========================================
  fastify.get(
    "/admin/users",
    { preHandler: [shouldBeAdmin] },
    userController.adminListUsers.bind(userController),
  );
  fastify.get(
    "/admin/users/:id",
    { preHandler: [shouldBeAdmin] },
    userController.adminGetUser.bind(userController),
  );
  fastify.patch(
    "/admin/users/:id/status",
    { preHandler: [shouldBeAdmin] },
    userController.adminUpdateStatus.bind(userController),
  );
};
