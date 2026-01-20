import Big from "big.js";
import type Stripe from "stripe";

import { convertWithEcb } from "@/lib/fx/ecb";
import { minorToMajor } from "@/lib/money";

type SnapshotCurrencyAgg = {
  currency: string;
  mrrMajor: Big;
  mrrBaseMajor: Big;
  subscriptions: number;
};

export type SnapshotMrrResult = {
  totalBaseMajor: Big;
  subscriptionsCount: number;
  byCurrency: SnapshotCurrencyAgg[];
  warnings: string[];
};

function asUpperCurrency(code: string): string {
  return code.toUpperCase();
}

function getUnitAmountMinor(price: Stripe.Price): Big | null {
  if (typeof price.unit_amount === "number") return new Big(price.unit_amount);
  if (typeof price.unit_amount_decimal === "string" && price.unit_amount_decimal.trim() !== "") {
    return new Big(price.unit_amount_decimal);
  }
  return null;
}

function normalizeToMonthlyMajor(params: {
  amountPerIntervalMajor: Big;
  interval: Stripe.Price.Recurring.Interval;
  intervalCount: number;
}): Big {
  const intervalCount = Math.max(1, params.intervalCount);

  // Approximate conversions for day/week into month.
  // - Days per year: 365.2425
  // - Average month: year / 12
  const DAYS_PER_YEAR = new Big("365.2425");
  const DAYS_PER_MONTH = DAYS_PER_YEAR.div(12);
  const WEEKS_PER_MONTH = DAYS_PER_MONTH.div(7);

  switch (params.interval) {
    case "month":
      return params.amountPerIntervalMajor.div(intervalCount);
    case "year":
      return params.amountPerIntervalMajor.div(new Big(12).times(intervalCount));
    case "week":
      return params.amountPerIntervalMajor.times(WEEKS_PER_MONTH).div(intervalCount);
    case "day":
      return params.amountPerIntervalMajor.times(DAYS_PER_MONTH).div(intervalCount);
    default: {
      const exhaustive: never = params.interval;
      return exhaustive;
    }
  }
}

async function listSubscriptionsByStatus(params: {
  stripe: Stripe;
  status: Stripe.SubscriptionListParams.Status;
}): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];

  let startingAfter: string | undefined;
  // Stripe's max page size is 100.
  for (;;) {
    const page = await params.stripe.subscriptions.list({
      status: params.status,
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.items.data.price"],
    });

    out.push(...page.data);

    if (!page.has_more) break;
    const last = page.data[page.data.length - 1];
    if (!last) break;
    startingAfter = last.id;
  }

  return out;
}

export async function computeSnapshotMrr(params: {
  stripe: Stripe;
  baseCurrency: string;
  at: Date;
}): Promise<SnapshotMrrResult> {
  const warnings: string[] = [];
  const baseCurrency = asUpperCurrency(params.baseCurrency);

  const [active, trialing] = await Promise.all([
    listSubscriptionsByStatus({ stripe: params.stripe, status: "active" }),
    listSubscriptionsByStatus({ stripe: params.stripe, status: "trialing" }),
  ]);

  const subscriptions = [...active, ...trialing];

  const byCurrency = new Map<string, SnapshotCurrencyAgg>();

  for (const sub of subscriptions) {
    const items = sub.items?.data ?? [];
    if (items.length === 0) continue;

    // Assume a single currency per subscription.
    const subscriptionCurrency = asUpperCurrency(
      (sub.currency ?? items[0]?.price?.currency ?? "").toString()
    );
    if (!subscriptionCurrency) {
      warnings.push(`Subscription ${sub.id} has no currency; skipped.`);
      continue;
    }

    let subscriptionMrrMajor = new Big(0);

    for (const item of items) {
      const price = item.price;
      const recurring = price?.recurring;

      if (!price || !recurring) continue;

      if (recurring.usage_type && recurring.usage_type !== "licensed") {
        warnings.push(`Subscription item ${item.id} is metered usage; skipped for snapshot MRR.`);
        continue;
      }

      if (price.billing_scheme && price.billing_scheme !== "per_unit") {
        warnings.push(`Subscription item ${item.id} uses ${price.billing_scheme} billing; skipped for snapshot MRR.`);
        continue;
      }

      const unitAmountMinor = getUnitAmountMinor(price);
      if (!unitAmountMinor) {
        warnings.push(`Subscription item ${item.id} has no unit_amount; skipped for snapshot MRR.`);
        continue;
      }

      const quantity = typeof item.quantity === "number" ? item.quantity : 1;
      const amountMinor = unitAmountMinor.times(quantity);
      const amountMajor = minorToMajor(amountMinor, price.currency);

      const interval = recurring.interval;
      const intervalCount = recurring.interval_count ?? 1;
      const monthlyMajor = normalizeToMonthlyMajor({ amountPerIntervalMajor: amountMajor, interval, intervalCount });

      subscriptionMrrMajor = subscriptionMrrMajor.plus(monthlyMajor);
    }

    if (subscriptionMrrMajor.lte(0)) continue;

    let mrrBaseMajor = new Big(0);
    try {
      const converted = await convertWithEcb({
        amountMajor: subscriptionMrrMajor,
        from: subscriptionCurrency,
        to: baseCurrency,
        at: params.at,
      });
      mrrBaseMajor = converted.amountMajor;
    } catch (err) {
      warnings.push(
        `FX conversion failed for ${subscriptionCurrency} -> ${baseCurrency} (subscription ${sub.id}): ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    const agg = byCurrency.get(subscriptionCurrency) ?? {
      currency: subscriptionCurrency,
      mrrMajor: new Big(0),
      mrrBaseMajor: new Big(0),
      subscriptions: 0,
    };

    agg.mrrMajor = agg.mrrMajor.plus(subscriptionMrrMajor);
    agg.mrrBaseMajor = agg.mrrBaseMajor.plus(mrrBaseMajor);
    agg.subscriptions += 1;

    byCurrency.set(subscriptionCurrency, agg);
  }

  const rows = [...byCurrency.values()].sort((a, b) => b.mrrBaseMajor.cmp(a.mrrBaseMajor));
  const totalBaseMajor = rows.reduce((acc, r) => acc.plus(r.mrrBaseMajor), new Big(0));

  return {
    totalBaseMajor,
    subscriptionsCount: subscriptions.length,
    byCurrency: rows,
    warnings,
  };
}
