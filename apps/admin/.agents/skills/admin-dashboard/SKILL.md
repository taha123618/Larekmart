---
name: admin-dashboard
description: Use when modifying the admin dashboard in apps/admin, including TanStack tables, mutation queries, Cloudinary image uploads, or shadcn/ui components.
---

# Admin Dashboard Workflows

Guidance for developing administrator features in `apps/admin` (Next.js 15, port 3003).

## 1. Access Control & Protection

- Dashboard routes in `(dashboard)` are protected by `src/middleware.ts`.
- Non-admin users are redirected to `/unauthorized`.
- Server Components retrieve the admin auth token via `await auth().getToken()` and forward it in `Authorization: Bearer <token>`.

## 2. Data Tables (TanStack Table)

- Table definitions are organized per section: `columns.tsx` and `data-table.tsx`.
- Support sorting, filtering, and row actions (e.g. Delete Product, Edit User).

## 3. Mutations & Forms (TanStack Query + React Hook Form)

- Mutations use `@tanstack/react-query` `useMutation` with optimistic updates or cache invalidation (`queryClient.invalidateQueries`).
- Forms use `react-hook-form` + `@hookform/resolvers/zod` with shared schemas from `@repo/types`:
  - `ProductFormSchema`
  - `CategoryFormSchema`
  - `UserFormSchema`

## 4. Media Uploads

- Direct client-to-Cloudinary image uploads using `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
- Images are stored as URLs in the product form before submitting to `product-service`.

## 5. Verification

```bash
pnpm --filter admin check-types
pnpm --filter admin build
pnpm lint
```
