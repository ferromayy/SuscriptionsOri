import { createHash, randomBytes } from "crypto";

import { createDbClient } from "@/lib/db/client";
import { getAppUrl } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { deleteAllUserSessions } from "@/lib/auth/session";

const TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

async function userCanResetPassword(userId: string): Promise<boolean> {
  const db = createDbClient();

  const { data: user } = await db.from("users").select("email_verified_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user?.email_verified_at) {
    return false;
  }

  const { count } = await db.from("tenant_members").select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);

  return (count ?? 0) > 0;
}

export async function requestPasswordReset(
  email: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();
  const normalized = email.trim().toLowerCase();

  const { data: user } = await db.from("users").select("id, email, full_name")
    .eq("email", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user || !(await userCanResetPassword(user.id))) {
    return { error: null };
  }

  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  await db.from("password_reset_tokens").delete().eq("user_id", user.id);

  const { error } = await db.from("password_reset_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    return { error: error.message };
  }

  const resetUrl = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      name: user.full_name,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo enviar el email";
    return { error: message };
  }

  return { error: null };
}

export async function validatePasswordResetToken(
  token: string,
): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string }
> {
  const cleanToken = token.trim();

  if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
    return { ok: false, error: "El link no es válido" };
  }

  const db = createDbClient();
  const { data: row } = await db
    .from("password_reset_tokens")
    .select("id, user_id, expires_at")
    .eq("token_hash", hashToken(cleanToken))
    .maybeSingle();

  if (!row) {
    return { ok: false, error: "El link no es válido o ya fue usado" };
  }

  if (new Date(row.expires_at) < new Date()) {
    await db.from("password_reset_tokens").delete().eq("id", row.id);
    return { ok: false, error: "El link expiró. Pedí uno nuevo." };
  }

  const { data: user } = await db.from("users").select("id, email")
    .eq("id", row.user_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    return { ok: false, error: "No se encontró la cuenta" };
  }

  return { ok: true, userId: user.id, email: user.email };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string }
> {
  if (newPassword.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const validation = await validatePasswordResetToken(token);
  if (!validation.ok) {
    return validation;
  }

  const db = createDbClient();
  const passwordHash = await hashPassword(newPassword);

  const { error: updateError } = await db.from("users").update({ password_hash: passwordHash })
    .eq("id", validation.userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await db
    .from("password_reset_tokens")
    .delete()
    .eq("user_id", validation.userId);
  await deleteAllUserSessions(validation.userId);

  return {
    ok: true,
    userId: validation.userId,
    email: validation.email,
  };
}
