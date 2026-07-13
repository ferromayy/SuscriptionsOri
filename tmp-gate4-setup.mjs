import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_SLUG = "gate3";
const PLAN_NAME = "Gate3 Mensual";
const PLAN_PRICE_CENTS = 2000; // $20 ARS — mismo monto que las pruebas MP

async function main() {
  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", TENANT_SLUG)
    .is("deleted_at", null)
    .maybeSingle();
  if (tenantErr) throw tenantErr;
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} no encontrado`);

  const { data: existingPlan } = await db
    .from("plans")
    .select("id, name, price_cents, is_active")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  let plan = existingPlan;
  if (!plan) {
    const { data: created, error: planErr } = await db
      .from("plans")
      .insert({
        tenant_id: tenant.id,
        name: PLAN_NAME,
        description: "Plan de laboratorio Gate4 — suscripción mensual $20",
        price_cents: PLAN_PRICE_CENTS,
        currency: "ars",
        interval: "month",
        is_active: true,
        sort_order: 0,
      })
      .select("id, name, price_cents")
      .single();
    if (planErr) throw planErr;
    plan = created;
    console.log("created plan", plan);
  } else {
    console.log("plan exists", plan);
  }

  const { error: disconnectErr } = await db
    .from("tenant_mp_connections")
    .update({
      status: "disconnected",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null);
  if (disconnectErr) throw disconnectErr;
  console.log("disconnected old MP OAuth (app 8992…); reconectar con app seller test 5113…");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenant: tenant.slug,
        plan_id: plan.id,
        join_url: `https://suscriptions-ori.vercel.app/app/${tenant.slug}/join`,
        pagos_url: `https://suscriptions-ori.vercel.app/app/${tenant.slug}/pagos`,
        owner_login: "gate3-owner@oricafe.test / Gate3Test!2026",
        seller_mp: "test_user_2780243514135539636@testuser.com",
        buyer_mp: "test_user_1775802605817883876@testuser.com",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
