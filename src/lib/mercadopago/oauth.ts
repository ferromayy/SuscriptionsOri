import "server-only";

import { createHash, randomBytes } from "crypto";

import { createDbClient } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/mercadopago/crypto";
import {
  getMpApiBaseUrl,
  getMpAuthBaseUrl,
  getMpClientId,
  getMpClientSecret,
  getMpOAuthRedirectUri,
} from "@/lib/mercadopago/env";

const OAUTH_STATE_COOKIE = "mp_oauth_state";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 15;

export type MpTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  live_mode?: boolean;
  public_key?: string;
  token_type?: string;
  scope?: string;
};

export type TenantMpConnection = {
  id: string;
  tenantId: string;
  mpUserId: string | null;
  status: "connected" | "disconnected" | "error";
  liveMode: boolean;
  transferCbu: string | null;
  transferAlias: string | null;
  transferHolderName: string | null;
  connectedAt: string;
  tokenExpiresAt: string | null;
};

export function createOAuthState(tenantId: string, tenantSlug: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({
    tenantId,
    tenantSlug,
    nonce,
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  });
  return Buffer.from(payload).toString("base64url");
}

export function parseOAuthState(state: string): {
  tenantId: string;
  tenantSlug: string;
} | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as {
      tenantId?: string;
      tenantSlug?: string;
      exp?: number;
    };
    if (!parsed.tenantId || !parsed.tenantSlug || !parsed.exp) {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return { tenantId: parsed.tenantId, tenantSlug: parsed.tenantSlug };
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getMpClientId(),
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: getMpOAuthRedirectUri(),
  });

  return `${getMpAuthBaseUrl()}/authorization?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  code: string,
): Promise<MpTokenResponse> {
  const response = await fetch(`${getMpApiBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getMpClientId(),
      client_secret: getMpClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: getMpOAuthRedirectUri(),
      test_token: process.env.MP_USE_TEST_TOKEN === "true",
    }),
  });

  const data = (await response.json()) as MpTokenResponse & { message?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.message ?? "No se pudo conectar Mercado Pago");
  }

  data.live_mode = await resolveActualLiveMode(data.access_token, data.live_mode);

  return data;
}

/**
 * El campo `live_mode` que devuelve /oauth/token refleja el tipo de token
 * pedido (según el flag `test_token`), NO si la cuenta logueada es una
 * cuenta de prueba de Mercado Pago. Por eso lo verificamos contra la cuenta
 * real vía /users/me: las cuentas de test siempre tienen el tag "test_user",
 * sin importar qué tipo de token se haya solicitado.
 */
async function resolveActualLiveMode(
  accessToken: string,
  fallback: boolean | undefined,
): Promise<boolean | undefined> {
  try {
    const response = await fetch(`${getMpApiBaseUrl()}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return fallback;
    }

    const me = (await response.json()) as { tags?: string[] };
    if (!Array.isArray(me.tags)) {
      return fallback;
    }

    if (me.tags.includes("test_user")) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<MpTokenResponse> {
  const response = await fetch(`${getMpApiBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getMpClientId(),
      client_secret: getMpClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = (await response.json()) as MpTokenResponse & { message?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.message ?? "No se pudo renovar el token de Mercado Pago");
  }

  data.live_mode = await resolveActualLiveMode(data.access_token, data.live_mode);

  return data;
}

export async function upsertTenantMpConnection(
  tenantId: string,
  tokens: MpTokenResponse,
): Promise<void> {
  const db = createDbClient();
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const row = {
    tenant_id: tenantId,
    mp_user_id: tokens.user_id ? String(tokens.user_id) : null,
    access_token: encryptSecret(tokens.access_token),
    refresh_token: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : null,
    token_expires_at: expiresAt,
    live_mode: Boolean(tokens.live_mode),
    status: "connected" as const,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const { data: existing } = await db
    .from("tenant_mp_connections")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("tenant_mp_connections")
      .update(row)
      .eq("id", existing.id);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await db.from("tenant_mp_connections").insert(row);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getTenantMpConnection(
  tenantId: string,
): Promise<TenantMpConnection | null> {
  const db = createDbClient();
  const { data } = await db
    .from("tenant_mp_connections")
    .select(
      "id, tenant_id, mp_user_id, status, live_mode, transfer_cbu, transfer_alias, transfer_holder_name, connected_at, token_expires_at, deleted_at",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data || data.status !== "connected") {
    return null;
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    mpUserId: data.mp_user_id,
    status: data.status as TenantMpConnection["status"],
    liveMode: data.live_mode,
    transferCbu: data.transfer_cbu,
    transferAlias: data.transfer_alias,
    transferHolderName: data.transfer_holder_name,
    connectedAt: data.connected_at,
    tokenExpiresAt: data.token_expires_at,
  };
}

export async function getValidAccessTokenForTenant(
  tenantId: string,
): Promise<string | null> {
  const db = createDbClient();
  const { data } = await db
    .from("tenant_mp_connections")
    .select(
      "id, access_token, refresh_token, token_expires_at, status, deleted_at",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .eq("status", "connected")
    .maybeSingle();

  if (!data) {
    return null;
  }

  const accessToken = decryptSecret(data.access_token);
  const expiresAt = data.token_expires_at
    ? new Date(data.token_expires_at).getTime()
    : null;
  const needsRefresh =
    Boolean(data.refresh_token) &&
    expiresAt !== null &&
    expiresAt < Date.now() + 60_000;

  if (!needsRefresh || !data.refresh_token) {
    return accessToken;
  }

  const refreshed = await refreshAccessToken(decryptSecret(data.refresh_token));
  await upsertTenantMpConnection(tenantId, refreshed);
  return refreshed.access_token;
}

/**
 * Conexión manual con Access Token, para cuando el dueño de la aplicación
 * es el mismo comercio (MP no permite autorizarse a sí mismo por OAuth).
 * Valida el token contra /users/me y lo guarda como conexión activa.
 */
export async function connectTenantWithAccessToken(
  tenantId: string,
  accessToken: string,
): Promise<{ error: string } | { ok: true }> {
  const token = accessToken.trim();
  if (!token) {
    return { error: "Pegá el Access Token de producción de tu aplicación" };
  }

  const response = await fetch(`${getMpApiBaseUrl()}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return {
      error:
        "Mercado Pago rechazó ese Access Token. Verificá que sea el de producción (empieza con APP_USR-) y que lo hayas copiado completo.",
    };
  }

  const me = (await response.json()) as { id?: number | string; tags?: string[] };
  const isTestUser = Array.isArray(me.tags) && me.tags.includes("test_user");

  await upsertTenantMpConnection(tenantId, {
    access_token: token,
    user_id: me.id,
    live_mode: !isTestUser,
  });

  return { ok: true };
}

export async function disconnectTenantMp(tenantId: string): Promise<void> {
  const db = createDbClient();
  const { error } = await db
    .from("tenant_mp_connections")
    .update({
      status: "disconnected",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTransferDetails(
  tenantId: string,
  input: {
    transferCbu: string;
    transferAlias: string;
    transferHolderName: string;
  },
): Promise<{ error: string } | { ok: true }> {
  const db = createDbClient();
  const { error } = await db
    .from("tenant_mp_connections")
    .update({
      transfer_cbu: input.transferCbu.trim() || null,
      transfer_alias: input.transferAlias.trim() || null,
      transfer_holder_name: input.transferHolderName.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export function hashOAuthState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export { OAUTH_STATE_COOKIE };
