import { createDbClient } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";

function getBootstrapCredentials() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export async function ensureSuperAdminExists(): Promise<void> {
  const credentials = getBootstrapCredentials();
  if (!credentials) {
    return;
  }

  const db = createDbClient();

  const { data: existingUser } = await db.from("users").select("id")
    .eq("email", credentials.email)
    .is("deleted_at", null)
    .maybeSingle();

  let userId = existingUser?.id;

  if (!userId) {
    const passwordHash = await hashPassword(credentials.password);
    const { data: created, error } = await db
      .from("users")
      .insert({
        email: credentials.email,
        password_hash: passwordHash,
        full_name: "Super Admin",
        email_verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? "No se pudo crear el super admin");
    }

    userId = created.id;
  } else {
    await db.from("users").update({ email_verified_at: new Date().toISOString() })
      .eq("id", userId).is("deleted_at", null)
      .is("email_verified_at", null);
  }

  const { data: existingAdmin } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingAdmin) {
    await db.from("platform_admins").insert({ user_id: userId });
  }
}
