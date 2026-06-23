export const appCurrency = "EUR";
export const appCurrencySymbol = "€";

export const appCurrencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: appCurrency,
});

export type CurrencyPolarity = "positive" | "negative" | "minus";

export function formatCurrency(
  value: unknown,
  polarity: CurrencyPolarity = "positive"
) {
  const numericValue = Math.abs(Number(value));

  if (polarity === "positive") {
    return appCurrencyFormatter.format(numericValue);
  }

  return appCurrencyFormatter.format(-numericValue);
}

export function getCurrencyPrefix(
  polarity: CurrencyPolarity = "positive",
  symbol = appCurrencySymbol
) {
  return `${polarity === "negative" || polarity === "minus" ? "-" : ""}${symbol}`;
}

export function applyCurrencyPolarity(
  value: number | string | undefined,
  polarity: CurrencyPolarity = "positive"
) {
  if (value == null || value === "") {
    return "";
  }

  const magnitude = String(value).replace(/^-/, "");
  return `${polarity === "minus" ? "-" : ""}${magnitude}`;
}
