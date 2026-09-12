import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key_placeholder";
const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-08-27.basil" as any,
});

export default stripe;
