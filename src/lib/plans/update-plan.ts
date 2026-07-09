import "server-only";

import { createDbClient } from "@/lib/db/client";
import { pesosToCents } from "@/lib/plans/money";
import type { CreatePlanInput } from "@/lib/plans/schemas";

function nowIso(): string {
  return new Date().toISOString();
}

async function replacePlanFields(
  planId: string,
  input: CreatePlanInput,
): Promise<{ error: string } | { ok: true }> {
  const db = createDbClient();
  const deletedAt = nowIso();

  const { data: existingFields } = await db
    .from("plan_fields")
    .select("id")
    .eq("plan_id", planId)
    .is("deleted_at", null);

  const fieldIds = (existingFields ?? []).map((field) => field.id);

  if (fieldIds.length > 0) {
    const { error: optionsError } = await db
      .from("plan_field_options")
      .update({ deleted_at: deletedAt })
      .in("field_id", fieldIds)
      .is("deleted_at", null);

    if (optionsError) {
      return { error: optionsError.message };
    }

    const { error: fieldsError } = await db
      .from("plan_fields")
      .update({ deleted_at: deletedAt })
      .in("id", fieldIds)
      .is("deleted_at", null);

    if (fieldsError) {
      return { error: fieldsError.message };
    }
  }

  for (const [index, field] of input.fields.entries()) {
    const { data: createdField, error: fieldError } = await db
      .from("plan_fields")
      .insert({
        plan_id: planId,
        sort_order: index + 1,
        label: field.label,
        field_type: field.fieldType,
        affects_price: field.affectsPrice,
        is_required: true,
      })
      .select("id")
      .single();

    if (fieldError || !createdField) {
      return { error: fieldError?.message ?? "No se pudo actualizar un campo" };
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
      return { error: optionsError.message };
    }
  }

  return { ok: true };
}

export async function updateSubscriptionPlan(
  tenantId: string,
  planId: string,
  input: CreatePlanInput,
): Promise<{ error: string } | { ok: true }> {
  const db = createDbClient();

  const { data: plan } = await db
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!plan) {
    return { error: "Suscripción no encontrada" };
  }

  const { error: planError } = await db
    .from("plans")
    .update({
      name: input.name,
      internal_label: input.internalLabel || null,
      description: input.description || null,
      price_cents: pesosToCents(input.basePricePesos),
      currency: input.currency,
      field_count: input.fieldCount,
      is_active: input.isActive,
    })
    .eq("id", planId);

  if (planError) {
    return { error: planError.message };
  }

  const fieldsResult = await replacePlanFields(planId, input);
  if ("error" in fieldsResult) {
    return fieldsResult;
  }

  return { ok: true };
}

export async function deleteSubscriptionPlan(
  tenantId: string,
  planId: string,
): Promise<{ error: string } | { ok: true }> {
  const db = createDbClient();
  const deletedAt = nowIso();

  const { data: plan } = await db
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!plan) {
    return { error: "Suscripción no encontrada" };
  }

  const { data: fields } = await db
    .from("plan_fields")
    .select("id")
    .eq("plan_id", planId)
    .is("deleted_at", null);

  const fieldIds = (fields ?? []).map((field) => field.id);

  if (fieldIds.length > 0) {
    const { error: optionsError } = await db
      .from("plan_field_options")
      .update({ deleted_at: deletedAt })
      .in("field_id", fieldIds)
      .is("deleted_at", null);

    if (optionsError) {
      return { error: optionsError.message };
    }

    const { error: fieldsError } = await db
      .from("plan_fields")
      .update({ deleted_at: deletedAt })
      .in("id", fieldIds)
      .is("deleted_at", null);

    if (fieldsError) {
      return { error: fieldsError.message };
    }
  }

  const { error: planError } = await db
    .from("plans")
    .update({ deleted_at: deletedAt, is_active: false })
    .eq("id", planId);

  if (planError) {
    return { error: planError.message };
  }

  return { ok: true };
}

export async function countActiveSubscribersForPlan(
  planId: string,
): Promise<number> {
  const db = createDbClient();
  const { count } = await db
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .is("deleted_at", null);

  return count ?? 0;
}
