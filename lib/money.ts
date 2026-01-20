import Big from "big.js";

const fractionDigitsCache = new Map<string, number>();

export function currencyFractionDigits(currencyCode: string): number {
  const currency = currencyCode.toUpperCase();
  const cached = fractionDigitsCache.get(currency);
  if (cached !== undefined) return cached;

  // Intl knows the currency's standard fraction digits.
  // Example: USD => 2, JPY => 0.
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;

  fractionDigitsCache.set(currency, digits);
  return digits;
}

export function minorToMajor(minor: Big.Value, currencyCode: string): Big {
  const digits = currencyFractionDigits(currencyCode);
  const divisor = new Big(10).pow(digits);
  return new Big(minor).div(divisor);
}

export function formatCurrency(amountMajor: number, currencyCode: string, locale = "en-US"): string {
  const currency = currencyCode.toUpperCase();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currencyFractionDigits(currency),
  }).format(amountMajor);
}
