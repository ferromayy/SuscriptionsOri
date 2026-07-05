import {
  sendClientInviteEmail,
  type ClientInviteDelivery,
} from "@/lib/email/send-client-invite";
import { buildClientInviteUrl } from "@/lib/invitations/token";

export async function deliverClientInviteEmail(input: {
  to: string;
  code: string;
  inviteToken: string;
  tenantName: string;
}): Promise<ClientInviteDelivery> {
  return sendClientInviteEmail({
    to: input.to,
    code: input.code,
    inviteUrl: buildClientInviteUrl(input.inviteToken),
    tenantName: input.tenantName,
  });
}
