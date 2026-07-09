import { createHash, randomBytes } from "crypto";

import { createDbClient } from "@/lib/db/client";

import {
  SESSION_MAX_AGE_SECONDS,
  type SessionUser,
  type SessionWithUser,
} from "./types";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const db = createDbClient();
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();

  const { error } = await db.from("sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return token;
}

export async function getSessionByToken(
  token: string,
): Promise<SessionWithUser | null> {
  const db = createDbClient();
  const tokenHash = hashToken(token);

  const { data: session, error } = await db
    .from("sessions")
    .select("id, user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session) {
    return null;
  }

  if (new Date(session.expires_at) < new Date()) {
    await db.from("sessions").delete().eq("id", session.id);
    return null;
  }

  const { data: user, error: userError } = await db.from("users").select("id, email, full_name")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user) {
    return null;
  }

  return {
    id: session.id,
    userId: session.user_id,
    expiresAt: session.expires_at,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
    },
  };
}

export async function deleteSession(token: string): Promise<void> {
  const db = createDbClient();
  const tokenHash = hashToken(token);
  await db.from("sessions").delete().eq("token_hash", tokenHash);
}

export async function deleteSessionById(sessionId: string): Promise<void> {
  const db = createDbClient();
  await db.from("sessions").delete().eq("id", sessionId);
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  const db = createDbClient();
  await db.from("sessions").delete().eq("user_id", userId);
}

export async function findUserByEmail(
  email: string,
): Promise<
  (SessionUser & { passwordHash: string; emailVerifiedAt: string | null }) | null
> {
  const db = createDbClient();
  const normalized = email.trim().toLowerCase();

  const { data, error } = await db.from("users").select("id, email, full_name, password_hash, email_verified_at")
    .eq("email", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    passwordHash: data.password_hash,
    emailVerifiedAt: data.email_verified_at,
  };
}

export async function createUser(input: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<SessionUser> {
  const { hashPassword } = await import("@/lib/auth/password");
  const db = createDbClient();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const { data, error } = await db
    .from("users")
    .insert({
      email,
      password_hash: passwordHash,
      full_name: input.fullName ?? null,
    })
    .select("id, email, full_name")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el usuario");
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
  };
}

export async function updateUserCredentials(
  userId: string,
  input: { password: string; fullName?: string },
): Promise<void> {
  const { hashPassword } = await import("@/lib/auth/password");
  const db = createDbClient();
  const passwordHash = await hashPassword(input.password);

  const { error } = await db.from("users").update({
      password_hash: passwordHash,
      full_name: input.fullName ?? null,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
