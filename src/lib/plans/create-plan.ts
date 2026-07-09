import "server-only";

import { createDbClient } from "@/lib/db/client";
import { pesosToCents } from "@/lib/plans/money";
import type { CreatePlanInput } from "@/lib/plans/schemas";

export async function createSubscriptionPlan(
  tenantId: string,
  input: CreatePlanInput,
): Promise<{ planId: string } | { error: string }> {
  const db = createDbClient();

  const { data: plan, error: planError } = await db
    .from("plans")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      internal_label: input.internalLabel || null,
      description: input.description || null,
      price_cents: pesosToCents(input.basePricePesos),
      currency: input.currency,
      interval: "month",
      field_count: input.fieldCount,
      is_active: input.isActive,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return { error: planError?.message ?? "No se pudo crear la suscripción" };
  }

  for (const [index, field] of input.fields.entries()) {
    const { data: createdField, error: fieldError } = await db
      .from("plan_fields")
      .insert({
        plan_id: plan.id,
        sort_order: index + 1,
        label: field.label,
        field_type: field.fieldType,
        affects_price: field.affectsPrice,
        is_required: true,
      })
      .select("id")
      .single();

    if (fieldError || !createdField) {
      await db.from("plans").update({ deleted_at: new Date().toISOString() }).eq("id", plan.id);
      return { error: fieldError?.message ?? "No se pudo crear un campo" };
    }

    if (field.fieldType !== "select" || !field.options?.length) {
      continue;
    }

    const optionRows = field.options.map((option, optionIndex) => ({
      field_id: createdField.id,
      label: option.label,
      price_delta_cents:
        field.affectsPrice && option.priceDeltaPesos !== undefined
          ? pesosToCents(option.priceDeltaPesos)
          : 0,
      sort_order: optionIndex + 1,
    }));

    const { error: optionsError } = await db
      .from("plan_field_options")
      .insert(optionRows);

    if (optionsError) {
      await db.from("plans").update({ deleted_at: new Date().toISOString() }).eq("id", plan.id);
      return { error: optionsError.message };
    }
  }

  return { planId: plan.id };
}
