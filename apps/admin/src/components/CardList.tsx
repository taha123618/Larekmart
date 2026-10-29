import { Card, CardContent, CardFooter, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { AnalyticsEventType, OrderType, ProductsType } from "@repo/types";
import { auth } from "@clerk/nextjs/server";
import MediaImage from "./MediaImage";
import { getServiceUrl } from "@/services/gateway.service";

const CardList = async ({ title }: { title: string }) => {
  let products: ProductsType = [];
  let orders: OrderType[] = [];
  let events: AnalyticsEventType[] = [];

  const { getToken } = await auth();
  const token = await getToken();

  if (title === "Popular Products") {
    try {
      const prodUrl = getServiceUrl(
        process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL,
      );
      products = await fetch(
        `${prodUrl}/api/v1/products?limit=5&popular=true`,
      ).then((res) => (res.ok ? res.json() : []));
    } catch {
      products = [];
    }

    if (!products || products.length === 0) {
      try {
        const recUrl = getServiceUrl(
          process.env.NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL,
        );
        const prodUrl = getServiceUrl(
          process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL,
        );
        const recRes = await fetch(
          `${recUrl}/api/v1/recommendations/popular?limit=5`,
        );
        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData.items && recData.items.length > 0) {
            const fetched = await Promise.all(
              recData.items.map(
                async (i: { productId?: number; product_id?: number }) => {
                  const id = i.productId ?? i.product_id;
                  if (!id) return null;
                  const r = await fetch(`${prodUrl}/api/v1/products/${id}`);
                  return r.ok ? await r.json() : null;
                },
              ),
            );
            products = fetched.filter(
              (p): p is NonNullable<typeof p> => p !== null,
            );
          }
        }
      } catch {
        // Fallback silently if offline
      }
    }
  } else {
    // Attempt to fetch from analytic-service first, fallback to order-service
    try {
      const analyticUrl = getServiceUrl(
        process.env.NEXT_PUBLIC_ANALYTIC_SERVICE_URL,
      );
      events = await fetch(`${analyticUrl}/api/v1/analytics/events?limit=5`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => (res.ok ? res.json() : []));
    } catch {
      events = [];
    }

    if (events.length === 0) {
      try {
        const orderUrl = getServiceUrl(
          process.env.NEXT_PUBLIC_ORDER_SERVICE_URL,
        );
        orders = await fetch(`${orderUrl}/api/v1/orders?limit=5`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then((res) => (res.ok ? res.json() : []));
      } catch {
        orders = [];
      }
    }
  }

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">{title}</h1>
      <div className="flex flex-col gap-2">
        {title === "Popular Products" ? (
          products.length > 0 ? (
            products.map((item) => (
              <Card
                key={item.id}
                className="flex-row items-center justify-between gap-4 p-4"
              >
                <div className="w-12 h-12 rounded-sm relative overflow-hidden flex items-center justify-center">
                  <MediaImage
                    ref_={
                      Object.values(item.images as Record<string, string>)[0] ||
                      ""
                    }
                    alt={item.name}
                    size={48}
                    className="w-12 h-12 rounded-sm object-cover"
                  />
                </div>
                <CardContent className="flex-1 p-0">
                  <CardTitle className="text-sm font-medium">
                    {item.name}
                  </CardTitle>
                </CardContent>
                <CardFooter className="p-0 font-medium">
                  ${item.price}
                </CardFooter>
              </Card>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No popular products found.
            </p>
          )
        ) : events.length > 0 ? (
          events.map((item) => (
            <Card
              key={item.id}
              className="flex-row items-center justify-between gap-4 p-4"
            >
              <CardContent className="flex-1 p-0">
                <CardTitle className="text-sm font-medium truncate max-w-[140px]">
                  {item.user_id || "Anonymous"}
                </CardTitle>
                <Badge
                  variant={
                    item.event_type.includes("payment")
                      ? "default"
                      : "secondary"
                  }
                  className="text-[10px] mt-1"
                >
                  {item.event_type}
                </Badge>
              </CardContent>
              <CardFooter className="p-0 text-sm font-semibold">
                {item.amount !== null ? `$${item.amount.toFixed(2)}` : "—"}
              </CardFooter>
            </Card>
          ))
        ) : orders.length > 0 ? (
          orders.map((item) => (
            <Card
              key={item._id}
              className="flex-row items-center justify-between gap-4 p-4"
            >
              <CardContent className="flex-1 p-0">
                <CardTitle className="text-sm font-medium truncate max-w-[140px]">
                  {item.email}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] mt-1">
                  {item.status}
                </Badge>
              </CardContent>
              <CardFooter className="p-0 text-sm font-semibold">
                ${(item.amount / 100).toFixed(2)}
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            No recent transactions recorded.
          </p>
        )}
      </div>
    </div>
  );
};

export default CardList;
