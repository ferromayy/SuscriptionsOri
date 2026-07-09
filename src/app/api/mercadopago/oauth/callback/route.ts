import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  exchangeAuthorizationCode,
  OAUTH_STATE_COOKIE,
  parseOAuthState,
  upsertTenantMpConnection,
} from "@/lib/mercadopago/oauth";
import { getAppUrl } from "@/lib/env";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  const parsedState = state ? parseOAuthState(state) : null;
  const fallbackSlug = parsedState?.tenantSlug ?? "";

  if (error) {
    return NextResponse.redirect(
      `${getAppUrl()}/app/${fallbackSlug}/pagos?error=denied`,
    );
  }

  if (!code || !state || !savedState || state !== savedState || !parsedState) {
    return NextResponse.redirect(
      `${getAppUrl()}/app/${fallbackSlug || "unknown"}/pagos?error=invalid_state`,
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    await upsertTenantMpConnection(parsedState.tenantId, tokens);
    return NextResponse.redirect(
      `${getAppUrl()}/app/${parsedState.tenantSlug}/pagos?connected=1`,
    );
  } catch {
    return NextResponse.redirect(
      `${getAppUrl()}/app/${parsedState.tenantSlug}/pagos?error=exchange_failed`,
    );
  }
}
