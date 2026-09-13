import { z } from "zod";
import { ReindexRequestSchema } from "@repo/types";

export { ReindexRequestSchema };

export const ProductEventPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => v.toString()),
  name: z.string(),
  price: z.coerce.number(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  categorySlug: z.string().optional(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  images: z.record(z.string(), z.string()).optional(),
  inStock: z.boolean().optional(),
  rating: z.number().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export type ProductEventPayload = z.infer<typeof ProductEventPayloadSchema>;
