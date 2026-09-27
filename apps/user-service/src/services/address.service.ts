import { addressRepository } from "../repositories/address.repository.js";
import { getCached, setCached, invalidateUserCache, UserCacheKeys } from "../cache/user-cache.js";
import { publishUserEvent } from "../publishers/user.publisher.js";
import { userMetrics, logger } from "../observability/metrics.js";
import type { CreateAddressInput, UpdateAddressInput } from "@repo/types";

export class AddressService {
  async getAddresses(userId: string) {
    const cacheKey = UserCacheKeys.addresses(userId);
    const cached = await getCached<any>(cacheKey, "addresses");
    if (cached) {
      return cached;
    }

    const addresses = await addressRepository.findManyByUserId(userId);
    await setCached(cacheKey, addresses, 300);
    return addresses;
  }

  async getAddressById(userId: string, addressId: string) {
    return addressRepository.findById(addressId, userId);
  }

  async createAddress(userId: string, input: CreateAddressInput, authUserId?: string) {
    const address = await addressRepository.create(userId, input);

    userMetrics.addressesCreated.inc();
    await invalidateUserCache(userId, authUserId);

    await publishUserEvent("user.address_created", userId, {
      addressId: address.id,
      type: address.type,
      city: address.city,
      state: address.state,
      country: address.country,
      isDefault: address.isDefault,
    }, authUserId);

    logger.info(`Address created for user: ${userId}, addressId: ${address.id}`);
    return address;
  }

  async updateAddress(userId: string, addressId: string, input: UpdateAddressInput, authUserId?: string) {
    const existing = await addressRepository.findById(addressId, userId);
    if (!existing) {
      return null;
    }

    const updated = await addressRepository.update(addressId, userId, input);

    userMetrics.addressesUpdated.inc();
    await invalidateUserCache(userId, authUserId);

    await publishUserEvent("user.address_updated", userId, {
      addressId: updated.id,
      fields: Object.keys(input),
      type: updated.type,
      isDefault: updated.isDefault,
    }, authUserId);

    logger.info(`Address updated for user: ${userId}, addressId: ${updated.id}`);
    return updated;
  }

  async deleteAddress(userId: string, addressId: string, authUserId?: string) {
    const existing = await addressRepository.findById(addressId, userId);
    if (!existing) {
      return null;
    }

    const deleted = await addressRepository.delete(addressId, userId);
    await invalidateUserCache(userId, authUserId);

    await publishUserEvent("user.address_deleted", userId, {
      addressId,
    }, authUserId);

    logger.info(`Address deleted for user: ${userId}, addressId: ${addressId}`);
    return deleted;
  }
}

export const addressService = new AddressService();
