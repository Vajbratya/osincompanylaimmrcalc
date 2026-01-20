"use client";

import { useQuery } from "@tanstack/react-query";

import { LineChart } from "@/app/_components/LineChart";
import { MrrApiResponseSchema, type MrrApiResponse } from "@/lib/mrr/apiTypes";
import { formatCurrency } from "@/lib/money";

async function fetchMrr(): Promise<MrrApiResponse> {
  const res = await fetch("/api/mrr", { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to load /api/mrr (${res.status}): ${body}`);
  }

  const json = await res.json();
  const parsed = MrrApiResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid /api/mrr response: ${parsed.error.message}`);
  }
  return parsed.data;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Dashboard() {
  const query = useQuery({
    queryKey: ["mrr"],
    queryFn: fetchMrr,
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
        <div className="md:col-span-3 h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {query.error instanceof Error ? query.error.message : "Unknown error"}
      </div>
    );
  }

  const data = query.data;
  const base = data.baseCurrency;

  const chartData = data.recognized.months.map((m) => ({
    label: m.month,
    value: m.mrrBase,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Current MRR">
          <div className="text-2xl font-semibold tracking-tight">
            {formatCurrency(data.snapshot.totalBase, base)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Base currency: {base}</div>
        </Card>

        <Card title="Active subscriptions">
          <div className="text-2xl font-semibold tracking-tight">{data.snapshot.subscriptionsCount}</div>
          <div className="mt-1 text-xs text-slate-500">Statuses: active + trialing</div>
        </Card>

        <Card title="FX source">
          <div className="text-sm font-medium text-slate-900">{data.meta.fxProvider}</div>
          <div className="mt-1 text-xs text-slate-500">generated: {new Date(data.generatedAt).toLocaleString()}</div>
        </Card>
      </div>

      <Card title="Recognized MRR trend">
        <LineChart data={chartData} valueFormatter={(v) => formatCurrency(v, base)} />
      </Card>

      <Card title="Snapshot MRR by currency">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500">
                <th className="border-b border-slate-200 pb-2">Currency</th>
                <th className="border-b border-slate-200 pb-2">MRR (local)</th>
                <th className="border-b border-slate-200 pb-2">MRR ({base})</th>
                <th className="border-b border-slate-200 pb-2">Subs</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshot.byCurrency.map((row) => (
                <tr key={row.currency} className="text-sm">
                  <td className="border-b border-slate-100 py-2 font-medium text-slate-900">{row.currency}</td>
                  <td className="border-b border-slate-100 py-2 text-slate-700">
                    {formatCurrency(row.mrr, row.currency)}
                  </td>
                  <td className="border-b border-slate-100 py-2 text-slate-700">
                    {formatCurrency(row.mrrBase, base)}
                  </td>
                  <td className="border-b border-slate-100 py-2 text-slate-700">{row.subscriptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data.meta.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Warnings</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.meta.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
