"use client";

import { ShippingFormInputs } from "@repo/types";
import { PaymentElement, useCheckout } from "@stripe/react-stripe-js";
import { ConfirmError } from "@stripe/stripe-js";
import { useState } from "react";

const CheckoutForm = ({
  shippingForm,
}: {
  shippingForm: ShippingFormInputs;
}) => {
  const checkout = useCheckout();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ConfirmError | null>(null);

  const handleClick = async () => {
    setLoading(true);
    await checkout.updateEmail(shippingForm.email);
    await checkout.updateShippingAddress({
      name: "shipping_address",
      address: {
        line1: shippingForm.address,
        city: shippingForm.city,
        country: "US",
      },
    });

    const res = await checkout.confirm();
    if (res.type === "error") {
      setError(res.error);
    }
    setLoading(false);
  };

  return (
    <form className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "accordion" }} />
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        {loading ? "Processing Payment..." : "Pay Now"}
      </button>
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-400">
          {error.message}
        </div>
      )}
    </form>
  );
};

export default CheckoutForm;
