import ProductList from "@/components/ProductList";

type ProductsSearchParams = {
  category?: string;
  sort?: string;
  search?: string;
  color?: string;
  size?: string;
  min_price?: string;
  max_price?: string;
};

const ProductsPage = async ({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) => {
  const { category, sort, search, color, size, min_price, max_price } =
    await searchParams;

  return (
    <div className="">
      <ProductList
        category={category}
        sort={sort}
        search={search}
        color={color}
        size={size}
        min_price={min_price}
        max_price={max_price}
        params="products"
      />
    </div>
  );
};

export default ProductsPage;
