import { formatCents } from "@/lib/plans/money";
import {
  getMaximumPlanPriceCents,
  getMinimumPlanPriceCents,
} from "@/lib/plans/pricing-utils";
import type { PublicPlan } from "@/lib/plans/get-plans";

function toPriceablePlan(plan: PublicPlan) {
  return {
    basePriceCents: plan.priceCents,
    fields: plan.fields,
  };
}

export function formatPlanPrice(plan: PublicPlan): string {
  const priceable = toPriceablePlan(plan);
  const hasVariablePrice = plan.fields.some(
    (field) => field.affectsPrice && field.options.length > 0,
  );

  if (!hasVariablePrice) {
    return formatCents(plan.priceCents, plan.currency, plan.interval);
  }

  const minimum = getMinimumPlanPriceCents(priceable);
  const maximum = getMaximumPlanPriceCents(priceable);

  if (minimum === maximum) {
    return formatCents(minimum, plan.currency, plan.interval);
  }

  const minLabel = formatCents(minimum, plan.currency, plan.interval).replace(
    / \/ mes$/,
    "",
  );

  return `Desde ${minLabel} / mes`;
}

export function calculateLivePlanPrice(
  plan: PublicPlan,
  selectedOptions: Record<string, string>,
): number {
  let total = plan.priceCents;

  for (const field of plan.fields) {
    if (!field.affectsPrice) {
      continue;
    }

    const selectedOptionId = selectedOptions[field.id];
    const option = field.options.find((item) => item.id === selectedOptionId);
    if (option) {
      total += option.priceDeltaCents;
    }
  }

  return total;
}
