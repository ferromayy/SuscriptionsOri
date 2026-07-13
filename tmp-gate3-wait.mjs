import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash } from "crypto";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getKey() {
  return createHash("sha256")
    .update(
      process.env.MP_TOKEN_ENCRYPTION_KEY?.trim() ||
        process.env.SUPABASE_SECRET_KEY?.trim() ||
        "dev-only-mercadopago-key",
    )
    .digest();
}

function decrypt(payload) {
  const [iv, tag, data] = payload.split(".");
  const d = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(data, "base64url")),
    d.final(),
  ]).toString("utf8");
}

async function waitForConnection(slug, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: tenant } = await db
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (tenant) {
      const { data: conn } = await db
        .from("tenant_mp_connections")
        .select("access_token, live_mode, mp_user_id, status, connected_at")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .eq("status", "connected")
        .maybeSingle();
      if (conn) {
        return { tenant, conn };
      }
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Timeout esperando conexión MP (10 min)");
}

async function createPreapproval(token, payerEmail) {
  const end = new Date();
  end.setFullYear(end.getFullYear() + 2);
  const payload = {
    reason: "Gate3 diagnostico Ori (fuera de app)",
    external_reference: `gate3-${Date.now()}`,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 20,
      currency_id: "ARS",
      end_date: end.toISOString(),
    },
    back_url: "https://suscriptions-ori.vercel.app/app/gate3?payment=gate3",
    status: "pending",
  };

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
  return { http: res.status, data, payload };
}

const payerEmail =
  process.env.MP_BUYER_EMAIL ||
  "test_user_1775802605817883876@testuser.com";

console.log("Esperando que conectes Mercado Pago en /app/gate3/pagos ...");
const { tenant, conn } = await waitForConnection("gate3");
console.log("\n✔ Conexión detectada:", {
  mp_user_id: conn.mp_user_id,
  live_mode: conn.live_mode,
  connected_at: conn.connected_at,
});

const token = decrypt(conn.access_token);
const me = await fetch("https://api.mercadopago.com/users/me", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
console.log("Seller /users/me:", {
  id: me.id,
  email: me.email,
  nickname: me.nickname,
  tags: me.tags,
});

const { http, data, payload } = await createPreapproval(token, payerEmail);
console.log("\n=== PREAPPROVAL GATE3 ===");
console.log(JSON.stringify({ http, payload, result: {
  id: data.id,
  status: data.status,
  init_point: data.init_point,
  sandbox_init_point: data.sandbox_init_point,
  collector_id: data.collector_id,
  live_mode: data.live_mode,
  message: data.message,
  cause: data.cause,
} }, null, 2));

if (data.init_point) {
  console.log("\n>>> ABRÍ ESTE LINK EN INCÓGNITO <<<");
  console.log(data.init_point);
  console.log("\nLogin buyer:", payerEmail);
  console.log("Tarjeta: 4509 9535 6623 3704 | CVV 123 | 11/30");
  console.log("Nombre: APRO | Apellido: APRO | DNI: 12345678");
  console.log(`\nCuando termines, avisame. ID: ${data.id}`);
}
