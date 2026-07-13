import { createClient } from "@supabase/supabase-js";

/**
 * Gate 3 helpers:
 * 1) create-test-users  — POST /users/test_user with app credentials (password in claro)
 * 2) create-preapproval — needs SELLER_ACCESS_TOKEN env or pulls from tenant_mp_connections
 */

const APP_ACCESS_TOKEN =
  process.env.MP_APP_ACCESS_TOKEN?.trim() ||
  ""; // set when calling

const command = process.argv[2] || "help";

async function createTestUser(siteId = "MLA") {
  if (!APP_ACCESS_TOKEN) {
    throw new Error("Falta MP_APP_ACCESS_TOKEN");
  }
  const res = await fetch("https://api.mercadopago.com/users/test_user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${APP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site_id: siteId }),
  });
  const data = await res.json();
  console.log(JSON.stringify({ http: res.status, ...data }, null, 2));
  return data;
}

async function createPreapproval({ token, payerEmail, amount = 20 }) {
  const end = new Date();
  end.setFullYear(end.getFullYear() + 2);
  const payload = {
    reason: "Gate3 diagnostico Ori (fuera de app)",
    external_reference: `gate3-${Date.now()}`,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: "ARS",
      end_date: end.toISOString(),
    },
    back_url: "https://suscriptions-ori.vercel.app/?payment=gate3",
    status: "pending",
  };

  console.log("Request payload:", JSON.stringify(payload, null, 2));

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `gate3-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(
    JSON.stringify(
      {
        http: res.status,
        id: data.id,
        status: data.status,
        live_mode: data.live_mode,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
        collector_id: data.collector_id,
        message: data.message,
        error: data.error,
        cause: data.cause,
      },
      null,
      2,
    ),
  );
  return data;
}

async function tokenFromDb(tenantSlug) {
  const { createDecipheriv, createHash } = await import("crypto");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: tenant } = await db
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (!tenant) throw new Error(`Tenant ${tenantSlug} no encontrado`);

  const { data: conn } = await db
    .from("tenant_mp_connections")
    .select("access_token, live_mode, mp_user_id, status")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .eq("status", "connected")
    .maybeSingle();
  if (!conn) throw new Error(`Sin conexión MP en ${tenantSlug}`);

  const key = createHash("sha256")
    .update(
      process.env.MP_TOKEN_ENCRYPTION_KEY?.trim() ||
        process.env.SUPABASE_SECRET_KEY?.trim() ||
        "dev-only-mercadopago-key",
    )
    .digest();
  const [iv, tag, data] = conn.access_token.split(".");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  const token = Buffer.concat([
    d.update(Buffer.from(data, "base64url")),
    d.final(),
  ]).toString("utf8");

  console.log("Connection:", {
    tenant: tenant.slug,
    mp_user_id: conn.mp_user_id,
    live_mode: conn.live_mode,
    token_prefix: token.slice(0, 20),
  });
  return token;
}

async function fetchPreapproval(token, id) {
  const remote = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  console.log(
    JSON.stringify(
      {
        id: remote.id,
        status: remote.status,
        payer_id: remote.payer_id,
        collector_id: remote.collector_id,
        payment_method_id: remote.payment_method_id,
        live_mode: remote.live_mode,
        amount: remote.auto_recurring?.transaction_amount,
        last_modified: remote.last_modified,
        summarized: remote.summarized,
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (command === "create-test-user") {
    await createTestUser();
    return;
  }
  if (command === "create-preapproval") {
    const payerEmail =
      process.env.MP_BUYER_EMAIL ||
      "test_user_1775802605817883876@testuser.com";
    const slug = process.env.MP_TENANT_SLUG || "gate3";
    const token =
      process.env.SELLER_ACCESS_TOKEN || (await tokenFromDb(slug));
    await createPreapproval({ token, payerEmail, amount: 20 });
    return;
  }
  if (command === "status") {
    const id = process.argv[3];
    if (!id) throw new Error("Uso: status <preapproval_id>");
    const slug = process.env.MP_TENANT_SLUG || "gate3";
    const token =
      process.env.SELLER_ACCESS_TOKEN || (await tokenFromDb(slug));
    await fetchPreapproval(token, id);
    return;
  }
  console.log(`Uso:
  MP_APP_ACCESS_TOKEN=... node gate3.mjs create-test-user
  MP_TENANT_SLUG=gate3 node --env-file=.env.local gate3.mjs create-preapproval
  MP_TENANT_SLUG=gate3 node --env-file=.env.local gate3.mjs status <id>
`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
