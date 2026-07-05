"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { markEmailVerified } from "@/lib/auth/email-verification";
import { setSessionCookie } from "@/lib/auth/cookies";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  createUser,
  findUserByEmail,
} from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptClientInvitation } from "@/lib/invitations/accept-invitation";
import { getValidClientInvitation } from "@/lib/invitations/get-invitation";
import {
  isInviteCodeVerified,
  setInviteCodeVerified,
} from "@/lib/invitations/invite-verification-cookie";
import { verifyInvitationCode } from "@/lib/invitations/verify-invitation-code";

export type InviteActionState = {
  error: string | null;
};

export type InviteCodeState = {
  error: string | null;
  verified?: boolean;
};

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres");

const signUpSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(2, "Ingresá tu nombre"),
  password: passwordSchema,
});

const signInSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

const inviteCodeSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6),
});

async function acceptInvitationForUser(
  token: string,
  userId: string,
): Promise<string> {
  const invitation = await getValidClientInvitation(token);
  if (!invitation) {
    throw new Error("Invitación inválida o expirada");
  }

  const user = await findUserByEmail(invitation.email);
  if (!user || user.id !== userId) {
    throw new Error("El email no coincide con la invitación");
  }

  await acceptClientInvitation(
    invitation.id,
    userId,
    invitation.tenantId,
  );

  revalidatePath("/admin/tenants");
  revalidatePath("/admin");

  return invitation.tenant.slug;
}

export async function verifyInviteCodeAction(
  _prev: InviteCodeState,
  formData: FormData,
): Promise<InviteCodeState> {
  const parsed = inviteCodeSchema.safeParse({
    token: formData.get("token"),
    code: String(formData.get("code") ?? "").replace(/\s/g, ""),
  });

  if (!parsed.success) {
    return { error: "Ingresá el código de 6 dígitos" };
  }

  const result = await verifyInvitationCode(
    parsed.data.token,
    parsed.data.code,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  await setInviteCodeVerified(parsed.data.token);
  return { error: null, verified: true };
}

export async function signUpAndAcceptInvite(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = signUpSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { token, fullName, password } = parsed.data;

  if (!(await isInviteCodeVerified(token))) {
    return { error: "Primero ingresá el código de la invitación" };
  }

  const invitation = await getValidClientInvitation(token);
  if (!invitation) {
    return { error: "Invitación no disponible" };
  }

  const existing = await findUserByEmail(invitation.email);
  if (existing) {
    return {
      error: "Ya existe una cuenta. Usá «Ya tengo cuenta».",
    };
  }

  let slug: string;
  try {
    const user = await createUser({
      email: invitation.email,
      password,
      fullName,
    });
    await markEmailVerified(user.id);
    slug = await acceptInvitationForUser(token, user.id);
    const sessionToken = await createSession(user.id);
    await setSessionCookie(sessionToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta";
    return { error: message };
  }

  redirect(`/app/${slug}/onboarding`);
}

export async function signInAndAcceptInvite(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = signInSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { token, password } = parsed.data;

  if (!(await isInviteCodeVerified(token))) {
    return { error: "Primero ingresá el código de la invitación" };
  }

  const invitation = await getValidClientInvitation(token);
  if (!invitation) {
    return { error: "Invitación no disponible" };
  }

  const user = await findUserByEmail(invitation.email);
  if (!user) {
    return { error: "No hay cuenta con este email. Creá una primero." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Contraseña incorrecta" };
  }

  if (!user.emailVerifiedAt) {
    await markEmailVerified(user.id);
  }

  let slug: string;
  try {
    slug = await acceptInvitationForUser(token, user.id);
    const sessionToken = await createSession(user.id);
    await setSessionCookie(sessionToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo aceptar la invitación";
    return { error: message };
  }

  redirect(`/app/${slug}/onboarding`);
}

export async function acceptInviteAsLoggedIn(
  token: string,
): Promise<InviteActionState> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "No hay sesión activa" };
  }

  if (!(await isInviteCodeVerified(token))) {
    return { error: "Primero ingresá el código de la invitación" };
  }

  const invitation = await getValidClientInvitation(token);
  if (!invitation) {
    return { error: "Invitación no disponible" };
  }

  if (currentUser.email !== invitation.email) {
    return {
      error: `Esta invitación es para ${invitation.email}.`,
    };
  }

  let slug: string;
  try {
    slug = await acceptInvitationForUser(token, currentUser.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo aceptar la invitación";
    return { error: message };
  }

  redirect(`/app/${slug}/onboarding`);
}
