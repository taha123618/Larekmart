---
name: prisma-query-patterns
description: Use when writing Prisma queries, relations, nested includes, or transactions in packages/product-db.
---

# Prisma Query Patterns & Optimization

Guidance for database querying in `@repo/product-db`.

## 1. Relational Queries & Includes

- Query products with nested category:
  ```ts
  const products = await prisma.product.findMany({
    include: { category: true },
    where: { category: { slug: categorySlug } },
  });
  ```

## 2. JSON Images Mapping

- `Product.images` is stored as a JSON column mapping color keys to image URLs (`Record<string, string>`).
- Safe type assertion should be used when extracting image maps.

## 3. Transaction Support

- When performing multi-table writes (e.g. creating categories with products), use `prisma.$transaction([...])`.
