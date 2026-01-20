import { z } from "zod";

const EnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  BASE_CURRENCY: z.string().min(3).max(3).optional(),
  LOOKBACK_MONTHS: z.string().optional(),
});

export type ServerEnv = {
  stripeSecretKey: string;
  baseCurrency: string;
  lookbackMonths: number;
};

export function getServerEnv(): ServerEnv {
  const parsed = EnvSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    BASE_CURRENCY: process.env.BASE_CURRENCY,
    LOOKBACK_MONTHS: process.env.LOOKBACK_MONTHS,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid server env:\n${issues.join("\n")}`);
  }

  const lookbackMonthsRaw = parsed.data.LOOKBACK_MONTHS ?? "12";
  const lookbackMonths = Number.parseInt(lookbackMonthsRaw, 10);
  if (!Number.isFinite(lookbackMonths) || lookbackMonths <= 0 || lookbackMonths > 60) {
    throw new Error(`LOOKBACK_MONTHS must be an integer between 1 and 60 (got: ${lookbackMonthsRaw})`);
  }

  const baseCurrency = (parsed.data.BASE_CURRENCY ?? "USD").toUpperCase();

  return {
    stripeSecretKey: parsed.data.STRIPE_SECRET_KEY,
    baseCurrency,
    lookbackMonths,
  };
}
