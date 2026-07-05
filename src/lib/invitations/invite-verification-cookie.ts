import { cookies } from "next/headers";

import { hashInvitationToken } from "@/lib/invitations/token";

export const INVITE_VERIFIED_COOKIE = "invite_code_verified";

const MAX_AGE_SECONDS = 60 * 30; // 30 min para completar el registro

export async function setInviteCodeVerified(inviteToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(INVITE_VERIFIED_COOKIE, hashInvitationToken(inviteToken), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function isInviteCodeVerified(inviteToken: string): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(INVITE_VERIFIED_COOKIE)?.value;
  return value === hashInvitationToken(inviteToken);
}

export async function clearInviteCodeVerified(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_VERIFIED_COOKIE);
}
