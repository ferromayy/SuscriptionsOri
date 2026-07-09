import type { FieldChoiceInput } from "@/lib/plans/schemas";
import type { PlanFieldType } from "@/types/database";

export type PriceablePlan = {
  basePriceCents: number;
  fields: Array<{
    affectsPrice: boolean;
    options: Array<{ priceDeltaCents: number }>;
  }>;
};

export type ResolvedPlanField = {
  id: string;
  label: string;
  fieldType: PlanFieldType;
  affectsPrice: boolean;
  isRequired: boolean;
  sortOrder: number;
  options: Array<{
    id: string;
    label: string;
    priceDeltaCents: number;
    sortOrder: number;
  }>;
};

export type ResolvedPlan = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  internalLabel: string | null;
  basePriceCents: number;
  currency: string;
  interval: "month" | "year";
  fieldCount: number;
  fields: ResolvedPlanField[];
};

export type ValidatedChoice = {
  fieldId: string;
  optionId: string | null;
  textValue: string | null;
  priceDeltaCents: number;
};

export function calculateFinalPriceCents(
  plan: Pick<ResolvedPlan, "basePriceCents">,
  validatedChoices: ValidatedChoice[],
): number {
  const delta = validatedChoices.reduce(
    (sum, choice) => sum + choice.priceDeltaCents,
    0,
  );

  return plan.basePriceCents + delta;
}

export function validateFieldChoices(
  plan: ResolvedPlan,
  choices: FieldChoiceInput[],
): { choices: ValidatedChoice[] } | { error: string } {
  const choiceByField = new Map(choices.map((choice) => [choice.fieldId, choice]));

  if (choices.length !== plan.fields.length) {
    return { error: "Completá todas las opciones de la suscripción" };
  }

  const validated: ValidatedChoice[] = [];

  for (const field of plan.fields) {
    const choice = choiceByField.get(field.id);
    if (!choice) {
      return { error: `Falta completar el campo «${field.label}»` };
    }

    if (field.fieldType === "select") {
      if (!choice.optionId) {
        return { error: `Elegí una opción para «${field.label}»` };
      }

      const option = field.options.find((item) => item.id === choice.optionId);
      if (!option) {
        return { error: "Una de las opciones elegidas no es válida" };
      }

      validated.push({
        fieldId: field.id,
        optionId: option.id,
        textValue: null,
        priceDeltaCents: field.affectsPrice ? option.priceDeltaCents : 0,
      });
      continue;
    }

    if (!choice.textValue?.trim()) {
      return { error: `Completá el campo «${field.label}»` };
    }

    validated.push({
      fieldId: field.id,
      optionId: null,
      textValue: choice.textValue.trim(),
      priceDeltaCents: 0,
    });
  }

  return { choices: validated };
}

export function getMinimumPlanPriceCents(plan: PriceablePlan): number {
  let minimum = plan.basePriceCents;

  for (const field of plan.fields) {
    if (!field.affectsPrice || field.options.length === 0) {
      continue;
    }

    const smallestDelta = Math.min(
      ...field.options.map((option) => option.priceDeltaCents),
    );
    minimum += smallestDelta;
  }

  return minimum;
}

export function getMaximumPlanPriceCents(plan: PriceablePlan): number {
  let maximum = plan.basePriceCents;

  for (const field of plan.fields) {
    if (!field.affectsPrice || field.options.length === 0) {
      continue;
    }

    const largestDelta = Math.max(
      ...field.options.map((option) => option.priceDeltaCents),
    );
    maximum += largestDelta;
  }

  return maximum;
}
