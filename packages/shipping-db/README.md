# @repo/shipping-db

PostgreSQL Prisma client and migrations for Larekmart's `shipping-service`.

## Usage

```ts
import { prisma, ShipmentStatus } from "@repo/shipping-db";

const shipment = await prisma.shipment.findUnique({
  where: { id },
  include: { items: true, packages: true, trackingEvents: true },
});
```
