import { Dashboard } from "@/app/_components/Dashboard";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Multi-currency MRR</h1>
          <p className="mt-1 text-sm text-slate-600">
            Stripe active-subscription run-rate (snapshot) + invoice-based recognized MRR trend.
          </p>
        </div>
        <a
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
          href="/api/mrr"
          target="_blank"
          rel="noreferrer"
        >
          View raw JSON
        </a>
      </div>

      <div className="mt-6">
        <Dashboard />
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Snapshot MRR uses subscription item list prices (ignores coupons, proration, metered usage). Recognized MRR uses paid invoice line items distributed across their service periods.
      </p>
    </main>
  );
}
