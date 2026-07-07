import type { PublicPlan } from "@/lib/plans/get-plans";

export function formatPlanPrice(plan: PublicPlan): string {
  if (plan.priceCents === 0) {
    return "Gratis";
  }

  const amount = (plan.priceCents / 100).toLocaleString("es-AR", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
  });

  return `${amount} / ${plan.interval === "month" ? "mes" : "año"}`;
}
