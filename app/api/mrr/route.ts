import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { defaultMonthRangeUtc } from "@/lib/dates";
import { getStripeClient } from "@/lib/stripe";
import { computeSnapshotMrr } from "@/lib/mrr/snapshot";
import { computeRecognizedMrr } from "@/lib/mrr/recognized";

import type Big from "big.js";

export const runtime = "nodejs";

function bigToNumber(b: Big): number {
  // Keep enough precision for charting and avoid scientific notation.
  return Number(b.toFixed(6));
}

export async function GET(req: Request) {
  const env = getServerEnv();

  const url = new URL(req.url);
  const baseCurrencyParam = url.searchParams.get("base");
  const monthsParam = url.searchParams.get("months");

  const baseCurrency = (baseCurrencyParam ?? env.baseCurrency).toUpperCase();

  let lookbackMonths = env.lookbackMonths;
  if (monthsParam) {
    const n = Number.parseInt(monthsParam, 10);
    if (Number.isFinite(n) && n > 0 && n <= 60) lookbackMonths = n;
  }

  const range = defaultMonthRangeUtc(lookbackMonths);

  const stripe = getStripeClient();
  const now = new Date();

  const [snapshot, recognized] = await Promise.all([
    computeSnapshotMrr({ stripe, baseCurrency, at: now }),
    computeRecognizedMrr({ stripe, baseCurrency, start: range.start, end: range.end }),
  ]);

  const warnings = [...snapshot.warnings, ...recognized.warnings];

  const json = {
    baseCurrency,
    generatedAt: now.toISOString(),
    snapshot: {
      totalBase: bigToNumber(snapshot.totalBaseMajor),
      subscriptionsCount: snapshot.subscriptionsCount,
      byCurrency: snapshot.byCurrency.map((r) => ({
        currency: r.currency,
        mrr: bigToNumber(r.mrrMajor),
        mrrBase: bigToNumber(r.mrrBaseMajor),
        subscriptions: r.subscriptions,
      })),
    },
    recognized: {
      months: recognized.months.map((m) => ({
        month: m.key,
        mrrBase: bigToNumber(m.mrrBaseMajor),
      })),
    },
    meta: {
      fxProvider: "ECB euro reference rates",
      warnings,
    },
  };

  return NextResponse.json(json, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
