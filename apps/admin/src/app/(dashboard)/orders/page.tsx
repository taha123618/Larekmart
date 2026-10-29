import { auth } from "@clerk/nextjs/server";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { OrderType } from "@repo/types";
import { getApiGatewayUrl } from "@/services/gateway.service";

export const dynamic = "force-dynamic";

const getData = async (): Promise<OrderType[]> => {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    const orderUrl = getApiGatewayUrl();
    const res = await fetch(`${orderUrl}/api/v1/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.log(err);
    return [];
  }
};

const OrdersPage = async () => {
  const data = await getData();
  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md">
        <h1 className="font-semibold">All Payments</h1>
      </div>
      <DataTable columns={columns} data={data} />
    </div>
  );
};

export default OrdersPage;
