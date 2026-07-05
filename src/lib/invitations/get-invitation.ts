import { createDbClient } from "@/lib/db/client";
import { hashInvitationToken } from "@/lib/invitations/token";

export type ValidClientInvitation = {
  id: string;
  email: string;
  tenantId: string;
  expiresAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

export type InvitationPageState =
  | { kind: "not_found" }
  | { kind: "expired"; email: string; tenantName: string }
  | {
      kind: "already_accepted";
      email: string;
      tenantName: string;
      tenantSlug: string;
    }
  | { kind: "valid"; invitation: ValidClientInvitation };

export async function getClientInvitationState(
  token: string,
): Promise<InvitationPageState> {
  const db = createDbClient();
  const tokenHash = hashInvitationToken(token);

  const { data: invitation } = await db
    .from("platform_invitations")
    .select("id, email, status, expires_at, tenant_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) {
    return { kind: "not_found" };
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, slug, status")
    .eq("id", invitation.tenant_id)
    .maybeSingle();

  const tenantName = tenant?.name ?? "Organización";
  const tenantSlug = tenant?.slug ?? "";

  if (invitation.status === "accepted" || tenant?.status === "active") {
    return {
      kind: "already_accepted",
      email: invitation.email,
      tenantName,
      tenantSlug,
    };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { kind: "expired", email: invitation.email, tenantName };
  }

  if (invitation.status !== "pending" || tenant?.status !== "pending_owner") {
    return { kind: "not_found" };
  }

  return {
    kind: "valid",
    invitation: {
      id: invitation.id,
      email: invitation.email,
      tenantId: invitation.tenant_id,
      expiresAt: invitation.expires_at,
      tenant: {
        id: tenant!.id,
        name: tenant!.name,
        slug: tenant!.slug,
        status: tenant!.status,
      },
    },
  };
}

export async function getValidClientInvitation(
  token: string,
): Promise<ValidClientInvitation | null> {
  const state = await getClientInvitationState(token);
  return state.kind === "valid" ? state.invitation : null;
}
