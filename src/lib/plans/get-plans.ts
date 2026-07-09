import { createDbClient } from "@/lib/db/client";

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
};

export async function getActivePlansForTenant(
  tenantId: string,
): Promise<PublicPlan[]> {
  const db = createDbClient();
  const { data } = await db.from("plans").select("id, name, description, price_cents, currency, interval")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  return (data ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceCents: plan.price_cents,
    currency: plan.currency,
    interval: plan.interval as "month" | "year",
  }));
}

export async function ensureDefaultPlan(tenantId: string): Promise<void> {
  const db = createDbClient();
  const { count } = await db.from("plans").select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (count && count > 0) {
    return;
  }

  await db.from("plans").insert({
    tenant_id: tenantId,
    name: "Suscripción mensual",
    description: "Plan estándar",
    price_cents: 0,
    currency: "usd",
    interval: "month",
    is_active: true,
  });
}
