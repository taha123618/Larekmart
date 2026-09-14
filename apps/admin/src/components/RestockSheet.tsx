"use client";

import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import { InventoryRestockSchema } from "@repo/types";

interface RestockSheetProps {
  defaultValues?: {
    productId: number;
    variantId: string;
    warehouseId: string;
  };
  onSuccess?: () => void;
}

export default function RestockSheet({
  defaultValues,
  onSuccess,
}: RestockSheetProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const form = useForm<z.infer<typeof InventoryRestockSchema>>({
    resolver: zodResolver(InventoryRestockSchema),
    defaultValues: {
      productId: defaultValues?.productId ?? 1,
      variantId: defaultValues?.variantId ?? "default",
      warehouseId: defaultValues?.warehouseId ?? "main-warehouse",
      quantity: 10,
      reason: "Inventory restock",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof InventoryRestockSchema>) => {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || "http://localhost:8007"}/api/v1/inventory/restock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ message: "Restock failed" }));
        throw new Error(error.message || "Failed to restock inventory");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inventory restocked successfully!");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to restock inventory");
    },
  });

  const onSubmit = (data: z.infer<typeof InventoryRestockSchema>) => {
    mutation.mutate(data);
  };

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader className="mb-4">
        <SheetTitle>Restock Inventory</SheetTitle>
        <SheetDescription>
          Add units to available warehouse stock. An append-only RESTOCK entry
          will be recorded in the audit ledger.
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="productId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product ID</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    disabled={!!defaultValues}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="variantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variant ID (Size / Color)</FormLabel>
                <FormControl>
                  <Input disabled={!!defaultValues} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse ID</FormLabel>
                <FormControl>
                  <Input disabled={!!defaultValues} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity to Add</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason / PO Reference</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. PO-84920 Restock shipment"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Restocking..." : "Confirm Restock"}
          </Button>
        </form>
      </Form>
    </SheetContent>
  );
}
