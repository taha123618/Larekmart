import Image from "next/image";
import { Card, CardContent, CardFooter, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { AnalyticsEventType, OrderType, ProductsType } from "@repo/types";
import { auth } from "@clerk/nextjs/server";

const CardList = async ({ title }: { title: string }) => {
  let products: ProductsType = [];
  let orders: OrderType[] = [];
  let events: AnalyticsEventType[] = [];

  const { getToken } = await auth();
  const token = await getToken();

  if (title === "Popular Products") {
    try {
      products = await fetch(
        `${process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL}/products?limit=5&popular=true`,
      ).then((res) => (res.ok ? res.json() : []));
    } catch {
      products = [];
    }
  } else {
    // Attempt to fetch from analytic-service first, fallback to order-service
    try {
      events = await fetch(
        `${process.env.NEXT_PUBLIC_ANALYTIC_SERVICE_URL || "http://localhost:8004"}/analytics/events?limit=5`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      ).then((res) => (res.ok ? res.json() : []));
    } catch {
      events = [];
    }

    if (events.length === 0) {
      try {
        orders = await fetch(
          `${process.env.NEXT_PUBLIC_ORDER_SERVICE_URL}/orders?limit=5`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ).then((res) => (res.ok ? res.json() : []));
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
                <div className="w-12 h-12 rounded-sm relative overflow-hidden">
                  <Image
                    src={
                      Object.values(item.images as Record<string, string>)[0] ||
                      ""
                    }
                    alt={item.name}
                    fill
                    className="object-cover"
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
