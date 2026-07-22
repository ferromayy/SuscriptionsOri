"use server";

import { redirect } from "next/navigation";

import { revalidateAdmin } from "@/lib/admin/revalidate";
import { ensureSuperAdminExists } from "@/lib/auth/bootstrap";
import { resendVerificationForEmail } from "@/lib/auth/email-verification";
import {
  clearCurrentSession,
  establishSession,
} from "@/lib/auth/cookies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";
import { resolvePostLogoutRedirect } from "@/lib/auth/post-logout-redirect";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import { findUserByEmail } from "@/lib/auth/session";

export type AuthActionState = {
  error: string | null;
  success?: string | null;
};

type SignInResult = AuthActionState & { userId?: string };

async function signIn(email: string, password: string): Promise<SignInResult> {
  await ensureSuperAdminExists();

  const user = await findUserByEmail(email);
  if (!user) {
    return { error: "Credenciales inválidas" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Credenciales inválidas" };
  }

  if (!user.emailVerifiedAt) {
    return {
      error:
        "Tenés que verificar tu email antes de entrar. Revisá tu bandeja o pedí un reenvío abajo.",
    };
  }

  await establishSession(user.id);
  return { error: null, userId: user.id };
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
  const audienceRaw = String(formData.get("audience") ?? "auto").trim();
  const audience =
    audienceRaw === "subscriber" || audienceRaw === "manager"
      ? audienceRaw
      : "auto";

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const result = await signIn(email, password);
  if (result.error || !result.userId) {
    return { error: result.error ?? "Credenciales inválidas" };
  }

  if (audience === "subscriber") {
    if (!tenantSlug) {
      await clearCurrentSession();
      return { error: "Falta el comercio para iniciar sesión de suscriptor." };
    }
    const { assertSubscriberLoginAllowed } = await import(
      "@/lib/auth/assert-subscriber-login"
    );
    const blocked = await assertSubscriberLoginAllowed(
      result.userId,
      tenantSlug,
    );
    if (blocked) {
      await clearCurrentSession();
      return { error: blocked };
    }
  }

  if (audience === "manager") {
    const { assertManagerLoginAllowed } = await import(
      "@/lib/auth/assert-manager-login"
    );
    const blocked = await assertManagerLoginAllowed(result.userId);
    if (blocked) {
      await clearCurrentSession();
      return { error: blocked };
    }
  }

  const destination = await resolvePostLoginRedirect(result.userId, next, {
    tenantSlug: tenantSlug || null,
    audience,
  });
  redirect(destination);
}

export async function adminLoginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const result = await signIn(email, password);
  if (result.error || !result.userId) {
    return { error: result.error ?? "Credenciales inválidas" };
  }

  if (!(await isPlatformAdmin(result.userId))) {
    await clearCurrentSession();
    return { error: "No tienes permisos de Super Admin" };
  }

  redirect("/admin");
}

export async function resendVerificationAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Ingresá tu email" };
  }

  const result = await resendVerificationForEmail(email);
  if (result.error) {
    return { error: result.error };
  }

  return {
    error: null,
    success: "Si el email existe y no está verificado, enviamos un nuevo link.",
  };
}

export async function logoutAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();

  let destination = "/";
  if (tenantSlug) {
    destination = `/app/${tenantSlug}/join`;
  } else if (user) {
    destination = await resolvePostLogoutRedirect(user.id);
  }

  await clearCurrentSession();
  redirect(destination);
}
