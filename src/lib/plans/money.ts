export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: number): number {
  return cents / 100;
}

export function formatCents(
  cents: number,
  currency = "ars",
  period: "month" | "year" | 15 | 30 | 45 = "month",
): string {
  if (cents === 0) {
    return "Gratis";
  }

  const amount = (cents / 100).toLocaleString("es-AR", {
    style: "currency",
    currency: currency.toUpperCase(),
  });

  const suffix =
    period === "year"
      ? "año"
      : period === "month"
        ? "mes"
        : `${period} días`;

  return `${amount} / ${suffix}`;
}

export function billingCycleLabel(days: 15 | 30 | 45 | null | undefined): string {
  if (days === 15) return "Cada 15 días";
  if (days === 45) return "Cada 45 días";
  if (days === 30) return "Cada 30 días";
  return "—";
}
