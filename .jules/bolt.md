## 2025-03-01 - Frontend N+1 Image Resolution
**Learning:** `MediaImage` components in product lists fire individual client-side API requests to resolve `media:<uuid>` refs, causing a huge N+1 network waterfall (24 concurrent POST requests on `ProductList`).
**Action:** Always batch client-side entity resolution using a micro-task/timeout queue so components can remain decoupled while only hitting the network once per render tick.
