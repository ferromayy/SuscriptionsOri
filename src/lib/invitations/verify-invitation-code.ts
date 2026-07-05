import { createDbClient } from "@/lib/db/client";
import { hashInviteCode } from "@/lib/invitations/invite-code";
import { hashInvitationToken } from "@/lib/invitations/token";

export async function verifyInvitationCode(
  inviteToken: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleanCode = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "El código debe tener 6 dígitos" };
  }

  const db = createDbClient();
  const { data: invitation } = await db
    .from("platform_invitations")
    .select("id, status, expires_at, verification_code_hash")
    .eq("token_hash", hashInvitationToken(inviteToken))
    .maybeSingle();

  if (!invitation || invitation.status !== "pending") {
    return { ok: false, error: "Invitación inválida o ya usada" };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { ok: false, error: "La invitación expiró" };
  }

  if (!invitation.verification_code_hash) {
    return {
      ok: false,
      error: "Sin código en esta invitación. Pedí un nuevo email al administrador.",
    };
  }

  if (invitation.verification_code_hash !== hashInviteCode(cleanCode)) {
    return { ok: false, error: "Código incorrecto" };
  }

  return { ok: true };
}
