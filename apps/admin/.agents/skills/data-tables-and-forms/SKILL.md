---
name: data-tables-and-forms
description: Use when building TanStack data tables, column definitions, modal forms, or TanStack Query mutations in apps/admin.
---

# Data Tables & Form Mutations

Guidance for data presentation and mutations in `apps/admin`.

## 1. TanStack Table Setup

- Organize table files in `(dashboard)/<section>/`: `columns.tsx` and `data-table.tsx`.
- Column definitions (`ColumnDef<T>`): define sorting, custom cell rendering, action dropdowns.
- Features: pagination with `TablePagination.tsx`, filtering by name/search, and multi-selection.

## 2. Forms with Zod & React Hook Form

- Wrap form inputs using shadcn/ui components (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`).
- Integrate Zod schema validation using `zodResolver`:
  - `ProductFormSchema`
  - `CategoryFormSchema`
  - `UserFormSchema`

## 3. Query Client Cache Invalidation

- After successful mutations (`useMutation`), invalidate affected queries:
  ```ts
  const queryClient = useQueryClient();
  queryClient.invalidateQueries({ queryKey: ["products"] });
  ```
