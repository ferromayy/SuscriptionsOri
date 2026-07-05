import { createDbClient } from "@/lib/db/client";

export async function acceptClientInvitation(
  invitationId: string,
  userId: string,
  tenantId: string,
): Promise<void> {
  const db = createDbClient();

  const { data: existingMember } = await db
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingMember) {
    const { error: memberError } = await db.from("tenant_members").insert({
      tenant_id: tenantId,
      user_id: userId,
      role: "owner",
      joined_via: "client_invite",
      status: "active",
    });

    if (memberError) {
      throw new Error(memberError.message);
    }
  }

  const { error: tenantError } = await db
    .from("tenants")
    .update({ status: "active" })
    .eq("id", tenantId);

  if (tenantError) {
    throw new Error(tenantError.message);
  }

  const { error: invitationError } = await db
    .from("platform_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (invitationError) {
    throw new Error(invitationError.message);
  }
}
