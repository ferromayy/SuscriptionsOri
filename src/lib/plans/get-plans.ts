import { createDbClient } from "@/lib/db/client";
import type { PlanFieldType } from "@/types/database";

export type PlanFieldOption = {
  id: string;
  label: string;
  priceDeltaCents: number;
};

export type PlanField = {
  id: string;
  label: string;
  fieldType: PlanFieldType;
  affectsPrice: boolean;
  isRequired: boolean;
  sortOrder: number;
  options: PlanFieldOption[];
};

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  internalLabel: string | null;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
  fieldCount: number;
  isActive: boolean;
  fields: PlanField[];
};

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  internal_label: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  field_count: number;
  is_active: boolean;
};

async function attachFieldsToPlans(
  plans: PlanRow[],
): Promise<PublicPlan[]> {
  if (plans.length === 0) {
    return [];
  }

  const db = createDbClient();
  const planIds = plans.map((plan) => plan.id);

  const { data: fields } = await db
    .from("plan_fields")
    .select("id, plan_id, label, field_type, affects_price, is_required, sort_order")
    .in("plan_id", planIds)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const fieldIds = (fields ?? []).map((field) => field.id);
  const optionsByField = new Map<string, PlanFieldOption[]>();

  if (fieldIds.length > 0) {
    const { data: options } = await db
      .from("plan_field_options")
      .select("id, field_id, label, price_delta_cents")
      .in("field_id", fieldIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    for (const option of options ?? []) {
      const current = optionsByField.get(option.field_id) ?? [];
      current.push({
        id: option.id,
        label: option.label,
        priceDeltaCents: option.price_delta_cents,
      });
      optionsByField.set(option.field_id, current);
    }
  }

  const fieldsByPlan = new Map<string, PlanField[]>();
  for (const field of fields ?? []) {
    const current = fieldsByPlan.get(field.plan_id) ?? [];
    current.push({
      id: field.id,
      label: field.label,
      fieldType: field.field_type as PlanFieldType,
      affectsPrice: field.affects_price,
      isRequired: field.is_required,
      sortOrder: field.sort_order,
      options: optionsByField.get(field.id) ?? [],
    });
    fieldsByPlan.set(field.plan_id, current);
  }

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    internalLabel: plan.internal_label,
    priceCents: plan.price_cents,
    currency: plan.currency,
    interval: plan.interval as "month" | "year",
    fieldCount: plan.field_count,
    isActive: plan.is_active,
    fields: fieldsByPlan.get(plan.id) ?? [],
  }));
}

export async function getActivePlansForTenant(
  tenantId: string,
): Promise<PublicPlan[]> {
  const db = createDbClient();
  const { data } = await db
    .from("plans")
    .select(
      "id, name, description, internal_label, price_cents, currency, interval, field_count, is_active",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("price_cents", { ascending: true });

  return attachFieldsToPlans(data ?? []);
}

export async function getPlansForTenantManager(
  tenantId: string,
): Promise<PublicPlan[]> {
  const db = createDbClient();
  const { data } = await db
    .from("plans")
    .select(
      "id, name, description, internal_label, price_cents, currency, interval, field_count, is_active",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return attachFieldsToPlans(data ?? []);
}

export async function getPlanByIdForTenant(
  tenantId: string,
  planId: string,
): Promise<PublicPlan | null> {
  const db = createDbClient();
  const { data } = await db
    .from("plans")
    .select(
      "id, name, description, internal_label, price_cents, currency, interval, field_count, is_active",
    )
    .eq("tenant_id", tenantId)
    .eq("id", planId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const [plan] = await attachFieldsToPlans([data]);
  return plan ?? null;
}

export async function tenantHasPlanNamed(
  tenantId: string,
  name: string,
): Promise<boolean> {
  const db = createDbClient();
  const { count } = await db
    .from("plans")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .is("deleted_at", null);

  return (count ?? 0) > 0;
}
