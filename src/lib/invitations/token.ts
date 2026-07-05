import { createHash, randomBytes } from "crypto";

import { getAppUrl } from "@/lib/env";

export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildClientInviteUrl(token: string): string {
  return `${getAppUrl()}/invite/client/${token}`;
}
