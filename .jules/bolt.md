## 2024-10-24 - Batching Lazy Media Resolutions
**Learning:** React components (`MediaImage`) individually resolving media references (`media:<uuid>`) on mount trigger an N+1 request storm to `media-service` when rendering product grids (e.g., in `ProductList.tsx` or `FeaturedSection.tsx`).
**Action:** Implemented a single-tick micro-batching mechanism in `media.service.ts` using `setTimeout(..., 0)` to queue and accumulate concurrent `resolveMediaUrls` calls, flushing them as a single batched `/api/v1/media/resolve` request.
