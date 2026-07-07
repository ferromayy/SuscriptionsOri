import { cookies } from "next/headers";

import { getSessionTokenFromCookies } from "@/lib/auth/current-user";
import { createSession, deleteSession } from "@/lib/auth/session";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/types";

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function clearCurrentSession(): Promise<void> {
  const token = await getSessionTokenFromCookies();
  if (token) {
    await deleteSession(token);
  }
  await clearSessionCookie();
}

export async function establishSession(userId: string): Promise<void> {
  const token = await createSession(userId);
  await setSessionCookie(token);
}
