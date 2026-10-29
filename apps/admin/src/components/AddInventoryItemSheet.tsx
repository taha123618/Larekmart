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
import { getServiceUrl } from "@/services/gateway.service";

const CreateItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative().default(10),
});

interface AddInventoryItemSheetProps {
  onSuccess?: () => void;
}

export default function AddInventoryItemSheet({
  onSuccess,
}: AddInventoryItemSheetProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const form = useForm<
    z.input<typeof CreateItemSchema>,
    unknown,
    z.infer<typeof CreateItemSchema>
  >({
    resolver: zodResolver(CreateItemSchema),
    defaultValues: {
      productId: 1,
      variantId: "default",
      warehouseId: "main-warehouse",
      quantity: 50,
      reorderPoint: 10,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof CreateItemSchema>) => {
      const token = await getToken();
      const inventoryUrl = getServiceUrl(
        process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL,
      );
      const res = await fetch(
        `${inventoryUrl}/api/v1/inventory/items`,
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
          .catch(() => ({ message: "Creation failed" }));
        throw new Error(error.message || "Failed to create inventory item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inventory item initialized!");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create inventory item");
    },
  });

  const onSubmit = (data: z.infer<typeof CreateItemSchema>) => {
    mutation.mutate(data);
  };

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader className="mb-4">
        <SheetTitle>Initialize Warehouse Stock</SheetTitle>
        <SheetDescription>
          Setup tracked stock for a product variant at a specific warehouse.
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
                <FormLabel>Variant ID (e.g. s-black, m-blue)</FormLabel>
                <FormControl>
                  <Input placeholder="s-black" {...field} />
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
                  <Input placeholder="us-east-1" {...field} />
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
                <FormLabel>Initial Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
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
            name="reorderPoint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Reorder Threshold (Low-Stock Alert Trigger)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
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
            {mutation.isPending ? "Creating..." : "Initialize Stock"}
          </Button>
        </form>
      </Form>
    </SheetContent>
  );
}
