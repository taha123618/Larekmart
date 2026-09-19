import Link from "next/link";
import RecommendationSection from "@/components/RecommendationSection";
import ClearCartOnSuccess from "@/components/ClearCartOnSuccess";

const ReturnPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ session_id: string }> | undefined;
}) => {
  const session_id = (await searchParams)?.session_id;

  if (!session_id) {
    return <div>No session id found!</div>;
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL}/sessions/${session_id}`,
  );
  const data = await res.json();

  return (
    <div className="flex flex-col gap-8">
      <ClearCartOnSuccess status={data.status || data.paymentStatus} />
      <div className="p-6 rounded-xl border border-gray-100 shadow-sm bg-gray-50/50">
        <h1 className="text-xl font-semibold text-gray-900">
          Payment {data.status}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Payment status: {data.paymentStatus}
        </p>
        <Link
          href="/orders"
          className="inline-block mt-4 text-sm font-medium text-black underline underline-offset-4 hover:text-gray-700"
        >
          See your orders
        </Link>
      </div>

      <div className="border-t pt-8">
        <RecommendationSection
          title="Trending Styles Loved by Shoppers"
          subtitle="Top styles moving fast across the catalog"
          type="trending"
          limit={4}
        />
      </div>
    </div>
  );
};

export default ReturnPage;
