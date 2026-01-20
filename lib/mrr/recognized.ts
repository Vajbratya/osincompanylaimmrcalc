import Big from "big.js";
import type Stripe from "stripe";

import { convertWithEcb } from "@/lib/fx/ecb";
import { iterateMonthBucketsUtc, type MonthBucket } from "@/lib/dates";
import { minorToMajor } from "@/lib/money";

type MonthValue = { key: string; mrrBaseMajor: Big };

type RecognizedMrrResult = {
  months: MonthValue[];
  warnings: string[];
};

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}
function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

async function listPaidInvoices(params: {
  stripe: Stripe;
  createdGte: number;
  createdLt: number;
}): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await params.stripe.invoices.list({
      status: "paid",
      limit: 100,
      starting_after: startingAfter,
      created: {
        gte: params.createdGte,
        lt: params.createdLt,
      },
      expand: ["data.lines.data.price"],
    });

    invoices.push(...page.data);
    if (!page.has_more) break;

    const last = page.data[page.data.length - 1];
    if (!last) break;
    startingAfter = last.id;
  }

  return invoices;
}

function shouldIncludeLine(line: Stripe.InvoiceLineItem): boolean {
  if (line.proration) return false;

  // Prefer price.recurring when present; fall back to type.
  const hasRecurringPrice = Boolean(line.price && line.price.recurring);
  if (hasRecurringPrice) return true;

  return line.type === "subscription";
}

function allocateLineToMonths(params: {
  buckets: MonthBucket[];
  periodStart: Date;
  periodEnd: Date;
  amountBaseMajor: Big;
  monthValues: Map<string, Big>;
}) {
  const periodMs = params.periodEnd.getTime() - params.periodStart.getTime();
  if (periodMs <= 0) return;

  for (const bucket of params.buckets) {
    const overlapStart = maxDate(params.periodStart, bucket.start);
    const overlapEnd = minDate(params.periodEnd, bucket.end);
    const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
    if (overlapMs <= 0) continue;

    const ratio = new Big(overlapMs).div(periodMs);
    const allocated = params.amountBaseMajor.times(ratio);

    const prev = params.monthValues.get(bucket.key) ?? new Big(0);
    params.monthValues.set(bucket.key, prev.plus(allocated));
  }
}

export async function computeRecognizedMrr(params: {
  stripe: Stripe;
  baseCurrency: string;
  start: Date;
  end: Date;
}): Promise<RecognizedMrrResult> {
  const warnings: string[] = [];
  const baseCurrency = params.baseCurrency.toUpperCase();

  const buckets = iterateMonthBucketsUtc(params.start, params.end);
  const monthValues = new Map<string, Big>(buckets.map((b) => [b.key, new Big(0)]));

  // Need a lookback window because annual invoices created before the range can still cover
  // months in the chart range.
  const LOOKBACK_DAYS = 400;
  const createdGte = Math.floor((params.start.getTime() - LOOKBACK_DAYS * 24 * 60 * 60_000) / 1000);
  const createdLt = Math.floor(params.end.getTime() / 1000);

  const invoices = await listPaidInvoices({ stripe: params.stripe, createdGte, createdLt });

  for (const invoice of invoices) {
    const invoiceCurrency = (invoice.currency ?? "").toString().toUpperCase();
    if (!invoiceCurrency) {
      warnings.push(`Invoice ${invoice.id} has no currency; skipped.`);
      continue;
    }

    const invoiceCreated = new Date(invoice.created * 1000);

    const lines = invoice.lines?.data ?? [];
    if (!Array.isArray(lines) || lines.length === 0) continue;

    for (const line of lines) {
      if (!shouldIncludeLine(line)) continue;

      const periodStartSec = line.period?.start;
      const periodEndSec = line.period?.end;
      if (typeof periodStartSec !== "number" || typeof periodEndSec !== "number") continue;

      const periodStart = new Date(periodStartSec * 1000);
      const periodEnd = new Date(periodEndSec * 1000);

      const amountMinor =
        typeof (line as any).amount_excluding_tax === "number" ? (line as any).amount_excluding_tax : line.amount;

      if (typeof amountMinor !== "number") continue;
      if (amountMinor === 0) continue;

      const amountMajor = minorToMajor(amountMinor, invoiceCurrency);

      let amountBaseMajor: Big;
      try {
        const converted = await convertWithEcb({
          amountMajor,
          from: invoiceCurrency,
          to: baseCurrency,
          at: invoiceCreated,
        });
        amountBaseMajor = converted.amountMajor;
      } catch (err) {
        warnings.push(
          `FX conversion failed for invoice ${invoice.id} (${invoiceCurrency} -> ${baseCurrency}): ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      allocateLineToMonths({ buckets, periodStart, periodEnd, amountBaseMajor, monthValues });
    }
  }

  const months: MonthValue[] = buckets.map((b) => ({
    key: b.key,
    mrrBaseMajor: monthValues.get(b.key) ?? new Big(0),
  }));

  return { months, warnings };
}
