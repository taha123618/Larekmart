import type { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cart.service.js";
import { cartItemService } from "../services/cart-item.service.js";
import { mergeService } from "../services/merge.service.js";
import {
  AddToCartSchema,
  UpdateCartItemSchema,
  MergeCartSchema,
  ApplyCouponSchema,
} from "@repo/types";

export class CartController {
  async getCart(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { formatted } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });
      res.status(200).json(formatted);
    } catch (error) {
      next(error);
    }
  }

  async getSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });
      const summary = cartService.getSummary(cart);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }

  async addItem(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = AddToCartSchema.parse(req.body);
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const updated = await cartItemService.addItem(cart, input);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async updateItem(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const itemId = req.params.item_id as string;
      const input = UpdateCartItemSchema.parse(req.body);

      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const updated = await cartItemService.updateItemQuantity(
        cart,
        itemId,
        input.quantity,
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async removeItem(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const itemId = req.params.item_id as string;
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const updated = await cartItemService.removeItem(cart, itemId);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async mergeCart(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res
          .status(401)
          .json({ message: "Authentication required to merge cart" });
        return;
      }

      const input = MergeCartSchema.parse(req.body);
      const merged = await mergeService.mergeCarts(
        req.userId,
        input.guestToken,
      );
      res.status(200).json(merged);
    } catch (error) {
      next(error);
    }
  }

  async applyCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = ApplyCouponSchema.parse(req.body);
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const updated = await cartService.applyCoupon(cart, input.code);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async removeCoupon(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const code = req.params.code as string;
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const updated = await cartService.removeCoupon(cart, code);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async clearCart(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const cleared = await cartService.clearCart(cart);
      res.status(200).json(cleared);
    } catch (error) {
      next(error);
    }
  }

  async refreshPricing(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cart } = await cartService.getOrCreateCart({
        userId: req.userId,
        guestToken: req.guestToken,
      });

      const refreshed = await cartService.refreshPricing(cart);
      res.status(200).json(refreshed);
    } catch (error) {
      next(error);
    }
  }

  async getAdminStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await cartService.getAdminStats();
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getRecentCarts(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const carts = await cartService.getRecentCarts(limit);
      res.status(200).json(carts);
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController();
