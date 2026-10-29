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
import { InventoryAdjustmentSchema } from "@repo/types";
import { getServiceUrl } from "@/services/gateway.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface AdjustSheetProps {
  defaultValues?: {
    productId: number;
    variantId: string;
    warehouseId: string;
  };
  onSuccess?: () => void;
}

export default function AdjustSheet({
  defaultValues,
  onSuccess,
}: AdjustSheetProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const form = useForm<
    z.input<typeof InventoryAdjustmentSchema>,
    unknown,
    z.infer<typeof InventoryAdjustmentSchema>
  >({
    resolver: zodResolver(InventoryAdjustmentSchema),
    defaultValues: {
      productId: defaultValues?.productId ?? 1,
      variantId: defaultValues?.variantId ?? "default",
      warehouseId: defaultValues?.warehouseId ?? "main-warehouse",
      quantityDelta: -1,
      movementType: "DAMAGE",
      reason: "Damaged during handling",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof InventoryAdjustmentSchema>) => {
      const token = await getToken();
      const inventoryUrl = getServiceUrl(
        process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL,
      );
      const res = await fetch(
        `${inventoryUrl}/api/v1/inventory/adjustments`,
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
          .catch(() => ({ message: "Adjustment failed" }));
        throw new Error(error.message || "Failed to adjust inventory");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inventory adjusted successfully!");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to adjust inventory");
    },
  });

  const onSubmit = (data: z.infer<typeof InventoryAdjustmentSchema>) => {
    mutation.mutate(data);
  };

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader className="mb-4">
        <SheetTitle>Adjust Stock</SheetTitle>
        <SheetDescription>
          Record inventory reconciliations, returns, or write off damaged stock.
          Positive numbers add stock; negative numbers deduct stock atomically.
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
                <FormLabel>Variant ID</FormLabel>
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
            name="movementType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adjustment Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select movement type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DAMAGE">
                      DAMAGE (Damage Write-off)
                    </SelectItem>
                    <SelectItem value="ADJUSTMENT">
                      ADJUSTMENT (Audit Reconciliation)
                    </SelectItem>
                    <SelectItem value="RETURN">
                      RETURN (Customer Return)
                    </SelectItem>
                    <SelectItem value="RESTOCK">
                      RESTOCK (Manual Add)
                    </SelectItem>
                    <SelectItem value="PURCHASE">
                      PURCHASE (Direct Inflow)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantityDelta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity Delta (Non-Zero)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g. -2 for damage, 5 for return"
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
                <FormLabel>Reason / Note</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Water damage during transit"
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
            {mutation.isPending ? "Applying..." : "Apply Adjustment"}
          </Button>
        </form>
      </Form>
    </SheetContent>
  );
}
