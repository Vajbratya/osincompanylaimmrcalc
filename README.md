# Multi-currency MRR (Stripe)

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black)](https://nextjs.org/)
[![Stripe](https://img.shields.io/badge/Stripe-API-635bff)](https://stripe.com/)

Built in-house at laudos.ai and now open-sourced.

A small Next.js (App Router) dashboard that:

- Computes **current MRR** from Stripe active + trialing subscriptions.
- Computes a **monthly MRR trend** by distributing paid invoice line items across their service periods.
- Converts everything into a **base currency** using **ECB euro reference exchange rates**.

> ECB reference rates are published for information purposes only (they are not meant for executing transactions).

## Quick start (Bun)

```bash
cd mrr-multicurrency-app
cp .env.example .env.local
# edit .env.local and set STRIPE_SECRET_KEY

bun install
bun run dev
```

Open:

- Dashboard: http://localhost:3000
- Raw API: http://localhost:3000/api/mrr

## Configuration

Environment variables:

- `STRIPE_SECRET_KEY` (required)
- `BASE_CURRENCY` (default: `USD`)
- `LOOKBACK_MONTHS` (default: `12`, max: `60`)

API query params:

- `/api/mrr?base=EUR` overrides base currency
- `/api/mrr?months=24` overrides lookback months

## Notes & limitations

- Snapshot MRR uses **subscription item list prices** and ignores coupons, prorations, and metered usage.
- Trend calculation uses **paid invoices** and **skips proration lines**.
- FX rates are from the ECB XML feed (`eurofxref-hist.xml`).
- If your Stripe account uses a currency not covered by the ECB feed, the API returns a warning and skips those lines.

## OSS notes

If you use this internally, please share improvements or bugfixes back. We plan to keep this small and focused.
