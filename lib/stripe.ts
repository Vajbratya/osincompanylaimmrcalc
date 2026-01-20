import Stripe from "stripe";

import { getServerEnv } from "@/lib/env";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;

  const env = getServerEnv();

  cached = new Stripe(env.stripeSecretKey, {
    apiVersion: "2024-06-20",
    typescript: true,
  });

  return cached;
}
