"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  changeUserPassword,
  deleteUserAccount,
  updateUserProfile,
} from "@/lib/auth/account";
import { clearCurrentSession } from "@/lib/auth/cookies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { passwordSchema } from "@/lib/auth/schemas";
import { getTenantRole } from "@/lib/auth/permissions";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export type AccountActionState = {
  error: string | null;
  success?: string | null;
};

const profileSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().trim().min(2, "Ingresá tu nombre"),
});

const passwordChangeSchema = z.object({
  tenantSlug: z.string().min(1),
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
  newPassword: passwordSchema,
});

const deleteAccountSchema = z.object({
  tenantSlug: z.string().min(1),
  password: z.string().min(1, "Ingresá tu contraseña para confirmar"),
});

async function requireAccountUser(tenantSlug: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/app/${tenantSlug}/login?next=/app/${tenantSlug}/cuenta`);
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    redirect("/");
  }

  const role = await getTenantRole(user.id, tenant.id);
  if (!role) {
    redirect("/");
  }

  return { user, tenant, role };
}

export async function updateProfileAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = profileSchema.safeParse({
    tenantSlug: formData.get("tenantSlug"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { tenantSlug, fullName } = parsed.data;
  const { user } = await requireAccountUser(tenantSlug);

  const result = await updateUserProfile(user.id, { fullName });
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath(`/app/${tenantSlug}/cuenta`);
  revalidatePath(`/app/${tenantSlug}`);

  return {
    error: null,
    success: "Datos actualizados",
  };
}

export async function changePasswordAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = passwordChangeSchema.safeParse({
    tenantSlug: formData.get("tenantSlug"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { tenantSlug, currentPassword, newPassword } = parsed.data;
  const { user } = await requireAccountUser(tenantSlug);

  const result = await changeUserPassword(
    user.id,
    currentPassword,
    newPassword,
  );

  if (result.error) {
    return { error: result.error };
  }

  return {
    error: null,
    success: "Contraseña actualizada",
  };
}

export async function deleteAccountAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = deleteAccountSchema.safeParse({
    tenantSlug: formData.get("tenantSlug"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { tenantSlug, password } = parsed.data;
  const { user } = await requireAccountUser(tenantSlug);

  const result = await deleteUserAccount(user.id, password);
  if (result.error) {
    return { error: result.error };
  }

  await clearCurrentSession();
  redirect("/?cuenta-eliminada=1");
}
