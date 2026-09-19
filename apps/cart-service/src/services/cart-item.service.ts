import { Cart, type CartDocType } from "@repo/cart-db";
import {
  cartRepository,
  CartRepository,
} from "../repositories/cart.repository.js";
import { validationService } from "./validation.service.js";
import { pricingService } from "./pricing.service.js";
import { publishCartEvent } from "../publishers/cart.publisher.js";
import { invalidateCartCache } from "../cache/cart-cache.js";
import { cartOperationsCounter } from "../observability/metrics.js";
import type { AddToCartInputType, CartResponseType } from "@repo/types";

const MAX_ITEM_QUANTITY = 10;

export class CartItemService {
  async addItem(
    cart: CartDocType,
    input: AddToCartInputType,
  ): Promise<CartResponseType> {
    // 1. Validate product with product-service (falls back gracefully if service unreachable)
    const productInfo = await validationService.validateProduct(
      input.productId,
    );
    const unitPrice =
      typeof input.unitPrice === "number"
        ? input.unitPrice
        : productInfo?.price || 0;
    const name = input.name || productInfo?.name || "Clothing Item";
    const image = input.image || productInfo?.image || "";

    // 2. Best-effort availability check with inventory-service
    await validationService.checkInventoryAvailability(
      input.productId,
      input.quantity,
    );

    // 3. Find existing line item
    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId === input.productId &&
        (item.variantId || "") === (input.variantId || "") &&
        (item.size || "") === (input.size || "") &&
        (item.color || "") === (input.color || ""),
    );

    if (existingIndex > -1) {
      const existingItem = cart.items[existingIndex]!;
      const targetQuantity = existingItem.quantity + input.quantity;

      if (targetQuantity > MAX_ITEM_QUANTITY) {
        cart.adjustments.push({
          itemId: existingItem._id
            ? existingItem._id.toString()
            : existingItem.productId,
          productId: existingItem.productId,
          reason: `Quantity capped to maximum limit of ${MAX_ITEM_QUANTITY}`,
          oldQuantity: targetQuantity,
          newQuantity: MAX_ITEM_QUANTITY,
          createdAt: new Date(),
        } as any);
        existingItem.quantity = MAX_ITEM_QUANTITY;
      } else {
        existingItem.quantity = targetQuantity;
      }

      existingItem.unitPrice = unitPrice;
      existingItem.subtotal = existingItem.unitPrice * existingItem.quantity;
    } else {
      const initialQty = Math.min(input.quantity, MAX_ITEM_QUANTITY);
      if (input.quantity > MAX_ITEM_QUANTITY) {
        cart.adjustments.push({
          itemId: input.productId,
          productId: input.productId,
          reason: `Quantity capped to maximum limit of ${MAX_ITEM_QUANTITY}`,
          oldQuantity: input.quantity,
          newQuantity: MAX_ITEM_QUANTITY,
          createdAt: new Date(),
        } as any);
      }

      cart.items.push({
        productId: input.productId,
        variantId: input.variantId || null,
        name,
        image,
        size: input.size || "",
        color: input.color || "",
        quantity: initialQty,
        unitPrice,
        discountAmount: 0,
        subtotal: unitPrice * initialQty,
        metadata: input.metadata || {},
        pricingVersion: 1,
      } as any);
    }

    pricingService.recalculateCart(cart);
    cart.version = (cart.version || 1) + 1;
    await cart.save();

    await invalidateCartCache({
      userId: cart.userId,
      guestToken: cart.guestToken,
    });
    cartOperationsCounter.inc({ operation: "add_item", status: "success" });

    await publishCartEvent("cart.item_added", {
      cartId: cart._id.toString(),
      userId: cart.userId,
      guestToken: cart.guestToken,
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity,
    });

    return CartRepository.formatCart(cart);
  }

  async updateItemQuantity(
    cart: CartDocType,
    itemId: string,
    quantity: number,
  ): Promise<CartResponseType> {
    const itemIndex = cart.items.findIndex(
      (item) => item._id && item._id.toString() === itemId,
    );

    if (itemIndex === -1) {
      throw new Error(`Item with ID ${itemId} not found in cart`);
    }

    const item = cart.items[itemIndex]!;

    if (quantity <= 0) {
      // Remove item if quantity is 0
      const [removed] = cart.items.splice(itemIndex, 1);
      pricingService.recalculateCart(cart);
      cart.version = (cart.version || 1) + 1;
      await cart.save();

      await invalidateCartCache({
        userId: cart.userId,
        guestToken: cart.guestToken,
      });
      cartOperationsCounter.inc({
        operation: "remove_item",
        status: "success",
      });

      if (removed) {
        await publishCartEvent("cart.item_removed", {
          cartId: cart._id.toString(),
          userId: cart.userId,
          guestToken: cart.guestToken,
          productId: removed.productId,
          variantId: removed.variantId,
        });
      }

      return CartRepository.formatCart(cart);
    }

    const cappedQuantity = Math.min(quantity, MAX_ITEM_QUANTITY);
    if (quantity > MAX_ITEM_QUANTITY) {
      cart.adjustments.push({
        itemId,
        productId: item.productId,
        reason: `Quantity capped to maximum limit of ${MAX_ITEM_QUANTITY}`,
        oldQuantity: quantity,
        newQuantity: MAX_ITEM_QUANTITY,
        createdAt: new Date(),
      } as any);
    }

    item.quantity = cappedQuantity;
    item.subtotal = item.unitPrice * item.quantity;

    pricingService.recalculateCart(cart);
    cart.version = (cart.version || 1) + 1;
    await cart.save();

    await invalidateCartCache({
      userId: cart.userId,
      guestToken: cart.guestToken,
    });
    cartOperationsCounter.inc({ operation: "update_item", status: "success" });

    await publishCartEvent("cart.item_updated", {
      cartId: cart._id.toString(),
      userId: cart.userId,
      guestToken: cart.guestToken,
      productId: item.productId,
      variantId: item.variantId,
      quantity: cappedQuantity,
    });

    return CartRepository.formatCart(cart);
  }

  async removeItem(
    cart: CartDocType,
    itemId: string,
  ): Promise<CartResponseType> {
    const itemIndex = cart.items.findIndex(
      (item) => item._id && item._id.toString() === itemId,
    );

    if (itemIndex === -1) {
      return CartRepository.formatCart(cart);
    }

    const [removed] = cart.items.splice(itemIndex, 1);
    pricingService.recalculateCart(cart);
    cart.version = (cart.version || 1) + 1;
    await cart.save();

    await invalidateCartCache({
      userId: cart.userId,
      guestToken: cart.guestToken,
    });
    cartOperationsCounter.inc({ operation: "remove_item", status: "success" });

    if (removed) {
      await publishCartEvent("cart.item_removed", {
        cartId: cart._id.toString(),
        userId: cart.userId,
        guestToken: cart.guestToken,
        productId: removed.productId,
        variantId: removed.variantId,
      });
    }

    return CartRepository.formatCart(cart);
  }
}

export const cartItemService = new CartItemService();
