import { createDbClient } from "@/lib/db/client";
import { otherOrganizationErrorMessage, userHasActiveMembershipInOtherTenant } from "@/lib/auth/user-cleanup";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export async function completePublicSignup(
  userId: string,
  tenantSlug: string,
  planId: string,
): Promise<{ slug: string } | { error: string }> {
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    return { error: "Organización no encontrada" };
  }

  if (tenant.status !== "active") {
    return { error: "Esta organización no acepta suscriptos por ahora" };
  }

  if (!tenant.allowPublicSignup) {
    return { error: "El registro público está deshabilitado" };
  }

  const db = createDbClient();

  const { data: plan } = await db.from("plans").select("id")
    .eq("id", planId)
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) {
    return { error: "Plan no disponible" };
  }

  if (await userHasActiveMembershipInOtherTenant(userId, tenant.id)) {
    return { error: otherOrganizationErrorMessage() };
  }

  const { data: existingMember } = await db.from("tenant_members").select("id, role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    return { error: "Ya tenés una cuenta en esta organización" };
  }

  const { error: memberError } = await db.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "subscriber",
    joined_via: "public_signup",
    status: "active",
  });

  if (memberError) {
    return { error: memberError.message };
  }

  const { data: existingSub } = await db.from("subscriptions").select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingSub) {
    const { error: subError } = await db.from("subscriptions").insert({
      tenant_id: tenant.id,
      user_id: userId,
      plan_id: planId,
      status: "active",
    });

    if (subError) {
      return { error: subError.message };
    }
  }

  return { slug: tenant.slug };
}
