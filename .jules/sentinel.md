## 2026-10-02 - SQL Injection in Drizzle ORM queries using sql.raw

**Vulnerability:** A SQL injection vulnerability was found in the media service repository (`apps/media-service/src/db/repositories/media.repository.ts`). The `listByStatusOlderThan` function took an array of statuses from an untrusted source and constructed a raw SQL query using string interpolation combined with `sql.raw` in Drizzle ORM, allowing potential SQL injection.

**Learning:** Developers might use `sql.raw` with string interpolations like `.join(",")` when attempting to build array lookups, assuming it is safe or unaware of Drizzle's array handling primitives like `inArray`. This is a classic injection pattern when mapped directly to `.where()` without parameterization.

**Prevention:** Always use safe primitives like `inArray` instead of `sql.raw` when interpolating arrays into SQL queries. Drizzle ORM provides `inArray(column, array)` which securely parameterizes the underlying database query. Avoid any use of `sql.raw` unless absolutely necessary and completely sure that the input is sanitized and statically analyzed.
