import { ProductsType } from "@repo/types";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import BackfillSearchButton from "@/components/BackfillSearchButton";

const getData = async (): Promise<ProductsType> => {
  try {
    const productUrl =
      process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      "http://localhost:8080";
    const res = await fetch(
      `${productUrl}/products`,
    );
    const data = await res.json();
    return data;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const ProductPage = async () => {
  const data = await getData();
  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex items-center justify-between gap-4">
        <h1 className="font-semibold">All Products</h1>
        <BackfillSearchButton />
      </div>
      <DataTable columns={columns} data={data} />
    </div>
  );
};

export default ProductPage;
