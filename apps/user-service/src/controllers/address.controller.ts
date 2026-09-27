import type { FastifyReply, FastifyRequest } from "fastify";
import { addressService } from "../services/address.service.js";
import { userService } from "../services/user.service.js";
import { CreateAddressSchema, UpdateAddressSchema } from "@repo/types";

export class AddressController {
  async getMyAddresses(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const addresses = await addressService.getAddresses(user.id);
    return reply.status(200).send(addresses);
  }

  async getMyAddress(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const params = request.params as { addressId: string };
    const address = await addressService.getAddressById(user.id, params.addressId);

    if (!address) {
      return reply.status(404).send({ message: "Address not found or does not belong to you" });
    }

    return reply.status(200).send(address);
  }

  async createMyAddress(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const body = CreateAddressSchema.parse(request.body);
    const address = await addressService.createAddress(user.id, body, authUserId);

    return reply.status(201).send(address);
  }

  async updateMyAddress(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const params = request.params as { addressId: string };
    const body = UpdateAddressSchema.parse(request.body);

    const updated = await addressService.updateAddress(user.id, params.addressId, body, authUserId);
    if (!updated) {
      return reply.status(404).send({ message: "Address not found or does not belong to you" });
    }

    return reply.status(200).send(updated);
  }

  async deleteMyAddress(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const params = request.params as { addressId: string };
    const deleted = await addressService.deleteAddress(user.id, params.addressId, authUserId);

    if (!deleted) {
      return reply.status(404).send({ message: "Address not found or does not belong to you" });
    }

    return reply.status(200).send({ message: "Address deleted successfully", id: params.addressId });
  }
}

export const addressController = new AddressController();
