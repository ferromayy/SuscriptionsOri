import { createHash, randomInt } from "crypto";

import { createDbClient } from "@/lib/db/client";
import { getAppUrl } from "@/lib/env";
import { sendVerificationEmail } from "@/lib/email/send-verification";
import { acceptClientInvitation } from "@/lib/invitations/accept-invitation";
import {
  clearPendingPublicSignup,
  getPendingPublicSignup,
} from "@/lib/subscribers/pending-signup-cookie";
import { completePublicSignup } from "@/lib/subscribers/join-subscriber";

const CODE_TTL_MINUTES = 30;

type VerifiedSignupResult = {
  userId: string;
  email: string;
  tenantSlug: string | null;
  redirectTo: string | null;
};

async function finishVerifiedSignup(
  userId: string,
  email: string,
): Promise<VerifiedSignupResult> {
  const pending = await getPendingPublicSignup();

  if (pending) {
    const result = await completePublicSignup(
      userId,
      pending.tenantSlug,
      pending.planId,
      pending.fieldChoices,
      pending.checkout,
    );
    await clearPendingPublicSignup();

    if ("error" in result) {
      throw new Error(result.error);
    }

    return {
      userId,
      email,
      tenantSlug: result.slug,
      redirectTo: result.redirectUrl ?? `/app/${result.slug}`,
    };
  }

  const ownerSlug = await activatePendingTenantForUser(userId, email);

  return {
    userId,
    email,
    tenantSlug: ownerSlug,
    redirectTo: ownerSlug
      ? `/app/${ownerSlug}/onboarding`
      : "/auth/login?verified=1",
  };
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateSixDigitCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function markEmailVerified(userId: string): Promise<void> {
  const db = createDbClient();
  await db.from("users").update({ email_verified_at: new Date().toISOString() })
    .eq("id", userId).is("deleted_at", null);
  await db
    .from("email_verification_tokens")
    .delete()
    .eq("user_id", userId);
}

/** Activa el tenant si hay invitación pendiente para este email. */
export async function activatePendingTenantForUser(
  userId: string,
  email: string,
): Promise<string | null> {
  const db = createDbClient();
  const normalized = email.trim().toLowerCase();

  const { data: invitation } = await db.from("platform_invitations").select("id, tenant_id")
    .eq("email", normalized)
    .eq("status", "pending")
    .maybeSingle();

  if (!invitation) {
    return null;
  }

  const { data: tenant } = await db.from("tenants").select("id, slug, status")
    .eq("id", invitation.tenant_id)
    .maybeSingle();

  if (!tenant || tenant.status !== "pending_owner") {
    return null;
  }

  await acceptClientInvitation(invitation.id, userId, tenant.id);
  return tenant.slug;
}

export async function createAndSendVerificationCode(
  userId: string,
  email: string,
  fullName?: string | null,
): Promise<void> {
  const db = createDbClient();
  const code = generateSixDigitCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(
    Date.now() + CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  await db
    .from("email_verification_tokens")
    .delete()
    .eq("user_id", userId);

  const { error } = await db.from("email_verification_tokens").insert({
    user_id: userId,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  const verifyUrl = `${getAppUrl()}/auth/verify-email?email=${encodeURIComponent(email)}`;

  await sendVerificationEmail({
    to: email,
    code,
    verifyUrl,
    name: fullName,
  });
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<
  | {
      ok: true;
      userId: string;
      email: string;
      tenantSlug: string | null;
      redirectTo: string | null;
    }
  | { ok: false; error: string }
> {
  const normalized = email.trim().toLowerCase();
  const cleanCode = code.replace(/\s/g, "");

  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "El código debe tener 6 dígitos" };
  }

  const db = createDbClient();
  const { data: user } = await db.from("users").select("id, email, email_verified_at")
    .eq("email", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    return { ok: false, error: "No encontramos una cuenta con ese email" };
  }

  if (user.email_verified_at) {
    try {
      return { ok: true, ...(await finishVerifiedSignup(user.id, user.email)) };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo completar el registro";
      return { ok: false, error: message };
    }
  }

  const { data: row } = await db
    .from("email_verification_tokens")
    .select("id, expires_at")
    .eq("user_id", user.id)
    .eq("code_hash", hashCode(cleanCode))
    .maybeSingle();

  if (!row) {
    return { ok: false, error: "Código incorrecto" };
  }

  if (new Date(row.expires_at) < new Date()) {
    await db.from("email_verification_tokens").delete().eq("id", row.id);
    return { ok: false, error: "El código expiró. Pedí uno nuevo." };
  }

  await markEmailVerified(user.id);

  try {
    return { ok: true, ...(await finishVerifiedSignup(user.id, user.email)) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo completar el registro";
    return { ok: false, error: message };
  }
}

export async function resendVerificationForEmail(
  email: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();
  const normalized = email.trim().toLowerCase();

  const { data: user } = await db.from("users").select("id, email, full_name, email_verified_at")
    .eq("email", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    return { error: null };
  }

  if (user.email_verified_at) {
    return { error: "Este email ya está verificado" };
  }

  try {
    await createAndSendVerificationCode(user.id, user.email, user.full_name);
    return { error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo enviar el email";
    return { error: message };
  }
}
