import "server-only";

import { createDbClient } from "@/lib/db/client";
import type { ResolvedPlan } from "@/lib/plans/pricing-utils";
import type { PlanFieldType } from "@/types/database";

export async function loadResolvedPlan(
  planId: string,
  tenantId: string,
): Promise<ResolvedPlan | null> {
  const db = createDbClient();

  const { data: plan } = await db
    .from("plans")
    .select(
      "id, tenant_id, name, description, internal_label, price_cents, currency, interval, field_count",
    )
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!plan) {
    return null;
  }

  const { data: fields } = await db
    .from("plan_fields")
    .select("id, label, field_type, affects_price, is_required, sort_order")
    .eq("plan_id", planId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const fieldIds = (fields ?? []).map((field) => field.id);
  let optionsByField = new Map<
    string,
    ResolvedPlan["fields"][number]["options"]
  >();

  if (fieldIds.length > 0) {
    const { data: options } = await db
      .from("plan_field_options")
      .select("id, field_id, label, price_delta_cents, sort_order")
      .in("field_id", fieldIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    optionsByField = (options ?? []).reduce((map, option) => {
      const current = map.get(option.field_id) ?? [];
      current.push({
        id: option.id,
        label: option.label,
        priceDeltaCents: option.price_delta_cents,
        sortOrder: option.sort_order,
      });
      map.set(option.field_id, current);
      return map;
    }, new Map<string, ResolvedPlan["fields"][number]["options"]>());
  }

  return {
    id: plan.id,
    tenantId: plan.tenant_id,
    name: plan.name,
    description: plan.description,
    internalLabel: plan.internal_label,
    basePriceCents: plan.price_cents,
    currency: plan.currency,
    interval: plan.interval as "month" | "year",
    fieldCount: plan.field_count,
    fields: (fields ?? []).map((field) => ({
      id: field.id,
      label: field.label,
      fieldType: field.field_type as PlanFieldType,
      affectsPrice: field.affects_price,
      isRequired: field.is_required,
      sortOrder: field.sort_order,
      options: optionsByField.get(field.id) ?? [],
    })),
  };
}
