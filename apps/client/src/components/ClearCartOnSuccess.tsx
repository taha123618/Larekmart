"use client";

import { useEffect } from "react";
import useCartStore from "@/stores/cartStore";

export default function ClearCartOnSuccess({ status }: { status?: string }) {
  const { clearCart } = useCartStore();

  useEffect(() => {
    if (status === "complete" || status === "succeeded" || status === "paid") {
      clearCart();
    }
  }, [status, clearCart]);

  return null;
}
