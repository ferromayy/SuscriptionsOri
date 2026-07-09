export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: number): number {
  return cents / 100;
}

export function formatCents(
  cents: number,
  currency = "ars",
  interval: "month" | "year" = "month",
): string {
  if (cents === 0) {
    return "Gratis";
  }

  const amount = (cents / 100).toLocaleString("es-AR", {
    style: "currency",
    currency: currency.toUpperCase(),
  });

  return `${amount} / ${interval === "month" ? "mes" : "año"}`;
}
