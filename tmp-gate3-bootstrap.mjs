import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "gate3-owner@oricafe.test";
const PASSWORD = "Gate3Test!2026";
const FULL_NAME = "Gate3 Owner";
const TENANT_NAME = "Gate3 Lab";
const TENANT_SLUG = "gate3";

async function main() {
  // cleanup previous gate3 if any
  const { data: existing } = await db
    .from("tenants")
    .select("id")
    .eq("slug", TENANT_SLUG)
    .maybeSingle();
  if (existing) {
    await db.from("tenants").delete().eq("id", existing.id);
    console.log("cleaned previous gate3 tenant");
  }

  const { data: existingUser } = await db
    .from("users")
    .select("id")
    .eq("email", EMAIL)
    .maybeSingle();
  if (existingUser) {
    await db.from("users").delete().eq("id", existingUser.id);
    console.log("cleaned previous gate3 owner");
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const { data: user, error: userErr } = await db
    .from("users")
    .insert({
      email: EMAIL,
      password_hash: passwordHash,
      full_name: FULL_NAME,
      email_verified_at: new Date().toISOString(),
    })
    .select("id, email")
    .single();
  if (userErr) throw new Error(userErr.message);

  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      status: "active",
      settings: { allow_public_signup: true },
    })
    .select("id, slug")
    .single();
  if (tenantErr) throw new Error(tenantErr.message);

  const { error: memberErr } = await db.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
    joined_via: "client_invite",
    status: "active",
  });
  if (memberErr) throw new Error(memberErr.message);

  console.log(
    JSON.stringify(
      {
        ok: true,
        login_url: "https://suscriptions-ori.vercel.app/auth/login",
        email: EMAIL,
        password: PASSWORD,
        pagos_url: `https://suscriptions-ori.vercel.app/app/${TENANT_SLUG}/pagos`,
        seller_email: "test_user_2780243514135539636@testuser.com",
        seller_user: "TESTUSER2780243514135539636",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
