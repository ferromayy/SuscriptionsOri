"use server";

import { revalidateAdmin } from "@/lib/admin/revalidate";

import {
  buildClientInviteUrl,
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitations/token";
import {
  createInvitationCode,
} from "@/lib/invitations/invite-code";
import { requirePlatformAdmin } from "@/lib/auth/require-admin";
import { createDbClient } from "@/lib/db/client";
import { deleteTenantWithCleanup } from "@/lib/tenants/delete-tenant";
import { createTenantSchema } from "@/lib/validations/tenant";

const INVITATION_DAYS = 7;

export type CreateTenantState = {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
  success?: {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    ownerEmail: string;
    inviteUrl: string;
    expiresAt: string;
    inviteCode: string;
  };
};

export async function createTenantWithInvitation(
  _prevState: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const admin = await requirePlatformAdmin();

  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    ownerEmail: formData.get("ownerEmail"),
  });

  if (!parsed.success) {
    return {
      error: "Revisá los campos del formulario",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, slug, ownerEmail } = parsed.data;
  const db = createDbClient();

  const { data: existingSlug } = await db
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingSlug) {
    return {
      error: null,
      fieldErrors: { slug: ["Este slug ya está en uso"] },
    };
  }

  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .insert({
      name,
      slug,
      status: "pending_owner",
    })
    .select("id, name, slug")
    .single();

  if (tenantError || !tenant) {
    return { error: tenantError?.message ?? "No se pudo crear el tenant" };
  }

  const token = generateInvitationToken();
  const { code, codeHash } = createInvitationCode();
  const expiresAt = new Date(
    Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: invitationError } = await db
    .from("platform_invitations")
    .insert({
      tenant_id: tenant.id,
      email: ownerEmail,
      token_hash: hashInvitationToken(token),
      verification_code_hash: codeHash,
      invited_by: admin.id,
      status: "pending",
      expires_at: expiresAt,
    });

  if (invitationError) {
    await db.from("tenants").delete().eq("id", tenant.id);
    return { error: invitationError.message };
  }

  revalidateAdmin();

  return {
    error: null,
    success: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      ownerEmail,
      inviteUrl: buildClientInviteUrl(token),
      expiresAt,
      inviteCode: code,
    },
  };
}

export async function deleteTenant(tenantId: string): Promise<{ error: string | null }> {
  await requirePlatformAdmin();

  const result = await deleteTenantWithCleanup(tenantId);

  if (result.error) {
    return result;
  }

  revalidateAdmin();
  return { error: null };
}

export type RegenerateInviteState = {
  error: string | null;
  inviteUrl?: string;
  expiresAt?: string;
  inviteCode?: string;
};

export async function regenerateInvitation(
  tenantId: string,
): Promise<RegenerateInviteState> {
  const admin = await requirePlatformAdmin();
  const db = createDbClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, status")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return { error: "Tenant no encontrado" };
  }

  if (tenant.status === "active") {
    return { error: "El tenant ya está activo, no necesita invitación" };
  }

  const { data: pendingInvite } = await db
    .from("platform_invitations")
    .select("id, email")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .maybeSingle();

  if (!pendingInvite) {
    return { error: "No hay invitación pendiente para este tenant" };
  }

  await db
    .from("platform_invitations")
    .update({ status: "revoked" })
    .eq("id", pendingInvite.id);

  const token = generateInvitationToken();
  const { code, codeHash } = createInvitationCode();
  const expiresAt = new Date(
    Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await db.from("platform_invitations").insert({
    tenant_id: tenantId,
    email: pendingInvite.email,
    token_hash: hashInvitationToken(token),
    verification_code_hash: codeHash,
    invited_by: admin.id,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateAdmin();

  return {
    error: null,
    inviteUrl: buildClientInviteUrl(token),
    expiresAt,
    inviteCode: code,
  };
}
