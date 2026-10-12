"use client";

import { loadStripe } from "@stripe/stripe-js";
import { CheckoutProvider } from "@stripe/react-stripe-js";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, useMemo } from "react";
import { CartItemsType, ShippingFormInputs } from "@repo/types";
import CheckoutForm from "./CheckoutForm";
import useCartStore from "@/stores/cartStore";
import {
  AlertCircle,
  CreditCard,
  Banknote,
  RefreshCw,
  Loader2,
} from "lucide-react";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const isStripeConfigured = Boolean(
  publishableKey &&
    publishableKey.startsWith("pk_") &&
    !publishableKey.includes("...") &&
    publishableKey.length > 20,
);

const stripePromise = isStripeConfigured ? loadStripe(publishableKey!) : null;

const fetchClientSecret = async (
  cart: CartItemsType,
  token: string,
  cartId?: string,
): Promise<string> => {
  const paymentServiceUrl =
    process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090";

  const response = await fetch(
    `${paymentServiceUrl}/sessions/create-checkout-session`,
    {
      method: "POST",
      body: JSON.stringify({
        cart,
        cartId,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.checkoutSessionClientSecret) {
    const errorMsg =
      json?.error ||
      json?.message ||
      `Failed to initialize checkout session (${response.status}: ${response.statusText || "Error"})`;
    throw new Error(errorMsg);
  }

  return json.checkoutSessionClientSecret as string;
};

interface StripePaymentFormProps {
  shippingForm: ShippingFormInputs;
  onSwitchToCod?: () => void;
}

const StripePaymentForm = ({
  shippingForm,
  onSwitchToCod,
}: StripePaymentFormProps) => {
  const { cart, serverCart } = useCartStore();
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { getToken, userId } = useAuth();

  useEffect(() => {
    let isMounted = true;
    getToken()
      .then((jwt) => {
        if (isMounted) {
          setToken(jwt);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setToken(null);
          setAuthChecked(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [getToken, retryCount]);

  const handleFetchClientSecret = useMemo(() => {
    return async (): Promise<string> => {
      if (!token) {
        const err = new Error("Authentication token required for checkout");
        setInitError(err.message);
        throw err;
      }
      try {
        setInitError(null);
        const secret = await fetchClientSecret(cart, token, serverCart?.id);
        return secret;
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to initialize Stripe checkout session";
        setInitError(errorMsg);
        // Crucial: Re-throw to prevent resolving with undefined
        throw err instanceof Error ? err : new Error(errorMsg);
      }
    };
  }, [cart, token, serverCart?.id]);

  // Case 1: Stripe Publishable Key not configured in environment
  if (!isStripeConfigured || !stripePromise) {
    return (
      <div className="flex flex-col gap-5 p-6 bg-amber-50/60 border border-amber-200/90 rounded-2xl">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-amber-950">
              Stripe Gateway Configuration
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              Online credit card processing requires a valid Stripe publishable
              key in{" "}
              <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">
                .env
              </code>
              . You can complete your order right now without credentials using
              Cash on Delivery.
            </p>
          </div>
        </div>

        {onSwitchToCod && (
          <button
            type="button"
            onClick={onSwitchToCod}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Banknote className="w-4 h-4 text-emerald-400" />
            <span>Switch to Cash on Delivery (COD)</span>
          </button>
        )}
      </div>
    );
  }

  // Case 2: Waiting for Clerk Auth token
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span className="text-sm font-medium">
          Securing payment gateway session...
        </span>
      </div>
    );
  }

  // Case 3: User not authenticated
  if (!token && !userId) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center items-center">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="max-w-sm">
          <h3 className="text-sm font-bold text-slate-900">
            Sign in to Pay with Card
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Stripe checkout requires an active user session to link your payment
            and order receipts.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs mt-1">
          {onSwitchToCod && (
            <button
              type="button"
              onClick={onSwitchToCod}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Banknote className="w-4 h-4" />
              <span>Use Cash on Delivery</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Case 4: Gateway session initialization failure
  if (initError) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-rose-50/70 border border-rose-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-bold text-rose-950">
              Payment Gateway Notice
            </h4>
            <p className="text-xs text-rose-800 leading-relaxed">{initError}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setInitError(null);
              setRetryCount((c) => c + 1);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-rose-300 hover:bg-rose-100/60 text-rose-900 text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
          {onSwitchToCod && (
            <button
              type="button"
              onClick={onSwitchToCod}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              <span>Switch to Cash on Delivery (COD)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Case 5: Normal Stripe Embedded Checkout render
  return (
    <CheckoutProvider
      stripe={stripePromise}
      options={{
        fetchClientSecret: handleFetchClientSecret,
      }}
    >
      <CheckoutForm shippingForm={shippingForm} />
    </CheckoutProvider>
  );
};

export default StripePaymentForm;
