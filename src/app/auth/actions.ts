"use server";

import { redirect } from "next/navigation";

import { ensureSuperAdminExists } from "@/lib/auth/bootstrap";
import { resendVerificationForEmail } from "@/lib/auth/email-verification";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteSession,
  findUserByEmail,
} from "@/lib/auth/session";
import { getSessionTokenFromCookies } from "@/lib/auth/current-user";

export type AuthActionState = {
  error: string | null;
  success?: string | null;
};

async function signIn(email: string, password: string): Promise<AuthActionState> {
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

  const token = await createSession(user.id);
  await setSessionCookie(token);
  return { error: null };
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const result = await signIn(email, password);
  if (result.error) {
    return result;
  }

  redirect(next.startsWith("/") ? next : "/");
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
  if (result.error) {
    return result;
  }

  const user = await findUserByEmail(email);
  if (!user || !(await isPlatformAdmin(user.id))) {
    const token = await getSessionTokenFromCookies();
    if (token) {
      await deleteSession(token);
    }
    await clearSessionCookie();
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

export async function logoutAction(): Promise<void> {
  const token = await getSessionTokenFromCookies();
  if (token) {
    await deleteSession(token);
  }
  await clearSessionCookie();
  redirect("/");
}
