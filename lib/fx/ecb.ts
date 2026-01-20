import Big from "big.js";
import { XMLParser } from "fast-xml-parser";

type RatesByCurrency = Map<string, number>; // currency -> 1 EUR = rate (currency)

type EcbCache = {
  fetchedAtMs: number;
  ratesByDate: Map<string, RatesByCurrency>; // YYYY-MM-DD -> currency map
  availableDatesDesc: string[]; // newest -> oldest
  supportedCurrencies: Set<string>;
};

const ECB_HIST_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml";

let cache: EcbCache | null = null;

function isoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function loadEcbCache(): Promise<EcbCache> {
  // Refresh daily-ish.
  const now = Date.now();
  if (cache && now - cache.fetchedAtMs < 12 * 60 * 60_000) return cache;

  const res = await fetch(ECB_HIST_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ECB rates (${res.status} ${res.statusText})`);
  }

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });

  const data = parser.parse(xml) as any;

  const envelope = data["gesmes:Envelope"] ?? data["Envelope"] ?? data;
  const rootCube = envelope?.Cube;
  const timeCubesRaw = rootCube?.Cube;

  const timeCubes: any[] = Array.isArray(timeCubesRaw) ? timeCubesRaw : timeCubesRaw ? [timeCubesRaw] : [];
  if (timeCubes.length === 0) {
    throw new Error("ECB XML parse error: missing time cubes");
  }

  const ratesByDate = new Map<string, RatesByCurrency>();
  const supportedCurrencies = new Set<string>();
  supportedCurrencies.add("EUR");

  for (const t of timeCubes) {
    const date = String(t.time);
    const rates = new Map<string, number>();
    rates.set("EUR", 1);

    const currencyCubesRaw = t.Cube;
    const currencyCubes: any[] = Array.isArray(currencyCubesRaw)
      ? currencyCubesRaw
      : currencyCubesRaw
        ? [currencyCubesRaw]
        : [];

    for (const c of currencyCubes) {
      const currency = String(c.currency).toUpperCase();
      const rate = Number(c.rate);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      rates.set(currency, rate);
      supportedCurrencies.add(currency);
    }

    ratesByDate.set(date, rates);
  }

  const availableDatesDesc = [...ratesByDate.keys()].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  cache = {
    fetchedAtMs: now,
    ratesByDate,
    availableDatesDesc,
    supportedCurrencies,
  };

  return cache;
}

function getRatesForClosestDate(
  cache: EcbCache,
  targetDate: Date
): { date: string; rates: RatesByCurrency } {
  // ECB publishes business days only; pick the latest date <= target.
  let d = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

  for (let i = 0; i < 10; i += 1) {
    const key = isoDateUtc(d);
    const rates = cache.ratesByDate.get(key);
    if (rates) return { date: key, rates };
    d = addDaysUtc(d, -1);
  }

  // Fall back to newest available.
  const newestKey = cache.availableDatesDesc[0];
  const newestRates = cache.ratesByDate.get(newestKey);
  if (!newestRates) {
    throw new Error("ECB rates cache invariant failed (no newest rates)");
  }
  return { date: newestKey, rates: newestRates };
}

export async function getEcbFxRate(params: {
  from: string;
  to: string;
  at: Date;
}): Promise<{ rate: number; asOfDate: string }> {
  const from = params.from.toUpperCase();
  const to = params.to.toUpperCase();

  if (from === to) return { rate: 1, asOfDate: isoDateUtc(params.at) };

  const c = await loadEcbCache();
  const { date: asOfDate, rates } = getRatesForClosestDate(c, params.at);

  const fromRate = rates.get(from);
  const toRate = rates.get(to);

  if (!fromRate) {
    throw new Error(`ECB rates do not include currency: ${from}`);
  }
  if (!toRate) {
    throw new Error(`ECB rates do not include currency: ${to}`);
  }

  // ECB reference rates are quoted as: 1 EUR = X {currency}
  // Convert: from -> EUR -> to
  // amount_in_to = amount_in_from * (toRate / fromRate)
  const rate = toRate / fromRate;

  return { rate, asOfDate };
}

export async function convertWithEcb(params: {
  amountMajor: Big;
  from: string;
  to: string;
  at: Date;
}): Promise<{ amountMajor: Big; rate: number; asOfDate: string }> {
  const { rate, asOfDate } = await getEcbFxRate({ from: params.from, to: params.to, at: params.at });
  return {
    amountMajor: params.amountMajor.times(rate),
    rate,
    asOfDate,
  };
}

export async function getEcbSupportedCurrencies(): Promise<string[]> {
  const c = await loadEcbCache();
  return [...c.supportedCurrencies].sort();
}
