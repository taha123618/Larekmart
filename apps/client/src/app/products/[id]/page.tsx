import ProductInteraction from "@/components/ProductInteraction";
import RecommendationSection from "@/components/RecommendationSection";
import { ProductType } from "@repo/types";
import Image from "next/image";
import { notFound } from "next/navigation";

const fetchProduct = async (id: string): Promise<ProductType | null> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL}/products/${id}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object" || !("id" in data)) return null;
    return data as ProductType;
  } catch {
    return null;
  }
};

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  const product = await fetchProduct(id);
  if (!product) {
    return {
      title: "Product Not Found",
      description: "The requested product does not exist.",
    };
  }

  return {
    title: product.name,
    description: product.description,
  };
};

const ProductPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ color?: string; size?: string }>;
}) => {
  const { size, color } = await searchParams;
  const { id } = await params;

  const product = await fetchProduct(id);

  if (!product) {
    notFound();
  }

  const selectedSize =
    size ||
    (Array.isArray(product.sizes) && product.sizes[0]
      ? (product.sizes[0] as string)
      : "m");
  const selectedColor =
    color ||
    (Array.isArray(product.colors) && product.colors[0]
      ? (product.colors[0] as string)
      : "black");

  const productImage =
    (product.images as Record<string, string>)?.[selectedColor] ||
    (product.images ? Object.values(product.images)[0] : "") ||
    "";

  return (
    <div className="mt-12">
      <div className="flex flex-col gap-4 lg:flex-row md:gap-12">
        {/* IMAGE */}
        <div className="w-full lg:w-5/12 relative aspect-[2/3]">
          <img
            src={productImage}
            alt={product.name}
            className="object-contain rounded-md"
          />
        </div>
        {/* DETAILS */}
        <div className="w-full lg:w-7/12 flex flex-col gap-4">
          <h1 className="text-2xl font-medium">{product.name}</h1>
          <p className="text-gray-500">{product.description}</p>
          <h2 className="text-2xl font-semibold">
            $
            {typeof product.price === "number"
              ? product.price.toFixed(2)
              : "0.00"}
          </h2>
          <ProductInteraction
            product={product}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
          />
          {/* CARD INFO */}
          <div className="flex items-center gap-2 mt-4">
            <Image
              src="/klarna.png"
              alt="klarna"
              width={50}
              height={25}
              className="rounded-md"
            />
            <Image
              src="/cards.png"
              alt="cards"
              width={50}
              height={25}
              className="rounded-md"
            />
            <Image
              src="/stripe.png"
              alt="stripe"
              width={50}
              height={25}
              className="rounded-md"
            />
          </div>
          <p className="text-gray-500 text-xs">
            By clicking Pay Now, you agree to our{" "}
            <span className="underline hover:text-black">
              Terms & Conditions
            </span>{" "}
            and{" "}
            <span className="underline hover:text-black">Privacy Policy</span>.
            You authorize us to charge your selected payment method for the
            total amount shown. All sales are subject to our return and{" "}
            <span className="underline hover:text-black">Refund Policies</span>.
          </p>
        </div>
      </div>

      {/* RECOMMENDATIONS */}
      <div className="mt-16 flex flex-col gap-12 border-t pt-12">
        <RecommendationSection
          title="Frequently Bought Together"
          subtitle="Customers who purchased this item also loved"
          type="frequently_bought_together"
          productId={product.id}
          limit={4}
        />
        <RecommendationSection
          title="Similar Styles You May Like"
          subtitle="AI-powered visual and semantic similarity recommendations"
          type="similar"
          productId={product.id}
          categorySlug={product.categorySlug}
          limit={4}
        />
      </div>
    </div>
  );
};

export default ProductPage;
