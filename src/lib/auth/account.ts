import { createDbClient } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { softDeleteUserAccount  } from "@/lib/db/soft-delete";

export async function updateUserProfile(
  userId: string,
  input: { fullName: string },
): Promise<{ error: string | null }> {
  const db = createDbClient();
  const fullName = input.fullName.trim();

  if (fullName.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres" };
  }

  const { error } = await db.from("users").update({ full_name: fullName })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();

  const { data: user, error: fetchError } = await db.from("users").select("password_hash")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError || !user) {
    return { error: "No se encontró la cuenta" };
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return { error: "La contraseña actual no es correcta" };
  }

  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres" };
  }

  const passwordHash = await hashPassword(newPassword);
  const { error } = await db.from("users").update({ password_hash: passwordHash })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

async function isSoleOwnerOfActiveTenant(userId: string): Promise<boolean> {
  const db = createDbClient();

  const { data: memberships } = await db.from("tenant_members").select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active");

  for (const membership of memberships ?? []) {
    const { data: tenant } = await db.from("tenants").select("status")
      .eq("id", membership.tenant_id)
      .maybeSingle();

    if (tenant?.status !== "active") {
      continue;
    }

    const { count } = await db.from("tenant_members").select("*", { count: "exact", head: true })
      .eq("tenant_id", membership.tenant_id)
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      return true;
    }
  }

  return false;
}

export async function deleteUserAccount(
  userId: string,
  password: string,
): Promise<{ error: string | null }> {
  if (await isPlatformAdmin(userId)) {
    return {
      error:
        "Las cuentas de Super Admin no se pueden eliminar desde acá. Contactá soporte.",
    };
  }

  const db = createDbClient();
  const { data: user, error: fetchError } = await db.from("users").select("id, email, password_hash")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError || !user) {
    return { error: "No se encontró la cuenta" };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { error: "Contraseña incorrecta" };
  }

  if (await isSoleOwnerOfActiveTenant(userId)) {
    return {
      error:
        "Sos el único dueño de una organización activa. Pedile al Super Admin que elimine el tenant antes de borrar tu cuenta.",
    };
  }

  return softDeleteUserAccount(userId);
}
