---
name: zod-schema-design
description: Use when authoring Zod validation schemas, deriving TypeScript types with z.infer, or creating form schemas in packages/types.
---

# Zod Schema Design & Validation

Guidance for writing shared validation schemas in `@repo/types`.

## 1. Schema Conventions

- Define schemas with PascalCase: `ProductFormSchema`, `CategoryFormSchema`, `UserFormSchema`, `shippingFormSchema`.
- Derive TypeScript types directly from schemas:

  ```ts
  export const ProductFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    price: z.number().positive("Price must be greater than zero"),
    colors: z.array(z.string()).min(1),
    sizes: z.array(z.string()).min(1),
  });

  export type ProductFormValues = z.infer<typeof ProductFormSchema>;
  ```

## 2. Reusability Across Layers

- Used in `apps/admin` and `apps/client` with `@hookform/resolvers/zod`.
- Used in backend services (`product-service`, `auth-service`, `payment-service`) for input payload validation.
