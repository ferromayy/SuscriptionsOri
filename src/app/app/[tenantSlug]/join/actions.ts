"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAndSendVerificationCode } from "@/lib/auth/email-verification";
import {
  clearCurrentSession,
  establishSession,
} from "@/lib/auth/cookies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { passwordSchema } from "@/lib/auth/schemas";
import { getCheckEmailUrl } from "@/lib/auth/urls";
import { verifyPassword } from "@/lib/auth/password";
import {
  createUser,
  findUserByEmail,
  updateUserCredentials,
} from "@/lib/auth/session";
import { isOrphanAppUser } from "@/lib/auth/user-cleanup";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { setPendingPublicSignup } from "@/lib/subscribers/pending-signup-cookie";
import { completePublicSignup } from "@/lib/subscribers/join-subscriber";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export type JoinActionState = {
  error: string | null;
};

const signUpSchema = z.object({
  tenantSlug: z.string().min(1),
  planId: z.string().uuid("Elegí un plan"),
  fullName: z.string().trim().min(2, "Ingresá tu nombre"),
  email: z.string().email("Email inválido"),
  password: passwordSchema,
});

const signInSchema = z.object({
  tenantSlug: z.string().min(1),
  planId: z.string().uuid("Elegí un plan"),
  email: z.string().email("Email inválido"),
  password: passwordSchema,
});

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>;

async function validateJoinContext(
  tenantSlug: string,
  planId: string,
): Promise<{ error: string } | { tenantId: string }> {
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    return { error: "Organización no encontrada" };
  }

  if (tenant.status !== "active") {
    return { error: "Esta organización aún no está activa" };
  }

  if (!tenant.allowPublicSignup) {
    return { error: "El registro público no está habilitado" };
  }

  const plans = await getActivePlansForTenant(tenant.id);
  if (!plans.some((plan) => plan.id === planId)) {
    return { error: "Plan no válido" };
  }

  return { tenantId: tenant.id };
}

async function releaseSessionForDifferentEmail(email: string): Promise<void> {
  const current = await getCurrentUser();
  if (!current) {
    return;
  }

  if (current.email === email.trim().toLowerCase()) {
    return;
  }

  await clearCurrentSession();
}

async function validateSubscriberSignupEmail(
  email: string,
  tenantId: string,
): Promise<{ error: string } | { existing: ExistingUser | null }> {
  const existing = await findUserByEmail(email);
  if (!existing) {
    return { existing: null };
  }

  const role = await getTenantRole(existing.id, tenantId);
  if (role === "subscriber") {
    return {
      error:
        "Ya sos suscriptor de esta organización. Usá «Ya tengo cuenta».",
    };
  }

  if (isTenantManager(role)) {
    return {
      error:
        "Este email es del administrador. Registrate como suscriptor con otro email.",
    };
  }

  if (!(await isOrphanAppUser(existing.id))) {
    return {
      error: "Ya existe una cuenta con este email. Usá «Ya tengo cuenta».",
    };
  }

  return { existing };
}

export async function signUpAsSubscriber(
  _prev: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const parsed = signUpSchema.safeParse({
    tenantSlug: formData.get("tenantSlug"),
    planId: formData.get("planId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { tenantSlug, planId, fullName, email, password } = parsed.data;
  const context = await validateJoinContext(tenantSlug, planId);

  if ("error" in context) {
    return { error: context.error };
  }

  await releaseSessionForDifferentEmail(email);

  const emailValidation = await validateSubscriberSignupEmail(
    email,
    context.tenantId,
  );
  if ("error" in emailValidation) {
    return { error: emailValidation.error };
  }

  const existing = emailValidation.existing;
  const alreadyVerified = Boolean(existing?.emailVerifiedAt);
  let userId: string;

  try {
    if (existing) {
      await updateUserCredentials(existing.id, { password, fullName });
      userId = existing.id;
    } else {
      const user = await createUser({ email, password, fullName });
      userId = user.id;
    }

    await setPendingPublicSignup({ tenantSlug, planId });

    if (!alreadyVerified) {
      await createAndSendVerificationCode(userId, email, fullName);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta";
    return { error: message };
  }

  if (alreadyVerified) {
    const result = await completePublicSignup(userId, tenantSlug, planId);
    if ("error" in result) {
      return { error: result.error };
    }
    await establishSession(userId);
    redirect(`/app/${result.slug}`);
  }

  redirect(getCheckEmailUrl(email, tenantSlug));
}

export async function signInAndJoinAsSubscriber(
  _prev: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const parsed = signInSchema.safeParse({
    tenantSlug: formData.get("tenantSlug"),
    planId: formData.get("planId"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { tenantSlug, planId, email, password } = parsed.data;
  const context = await validateJoinContext(tenantSlug, planId);

  if ("error" in context) {
    return { error: context.error };
  }

  await releaseSessionForDifferentEmail(email);

  const user = await findUserByEmail(email);
  if (!user) {
    return { error: "No hay cuenta con este email. Creá una primero." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Contraseña incorrecta" };
  }

  if (!user.emailVerifiedAt) {
    await setPendingPublicSignup({ tenantSlug, planId });
    await createAndSendVerificationCode(user.id, email, user.fullName);
    redirect(getCheckEmailUrl(email, tenantSlug));
  }

  const result = await completePublicSignup(user.id, tenantSlug, planId);
  if ("error" in result) {
    return { error: result.error };
  }

  await establishSession(user.id);
  redirect(`/app/${result.slug}`);
}
