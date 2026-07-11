import "server-only";

import { getAppUrl } from "@/lib/env";
import { getMpApiBaseUrl } from "@/lib/mercadopago/env";
import { getValidAccessTokenForTenant } from "@/lib/mercadopago/oauth";

export type BillingInterval = "month" | "year";

export type CreatePreapprovalInput = {
  tenantId: string;
  reason: string;
  payerEmail: string;
  externalReference: string;
  amountPesos: number;
  billingInterval: BillingInterval;
  backUrl: string;
};

export type PreapprovalResult = {
  id: string;
  initPoint: string;
  status: string;
  liveMode: boolean | null;
  sandboxInitPoint: string | null;
  productionInitPoint: string | null;
};

export type PreapprovalRemote = {
  id: string;
  status: string;
  external_reference?: string;
  payer_email?: string;
  collector_id?: number;
  application_id?: number;
  init_point?: string;
  sandbox_init_point?: string;
  live_mode?: boolean;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number | string;
    currency_id?: string;
    end_date?: string;
  };
  summarized?: Record<string, unknown>;
};

function buildRecurrence(input: CreatePreapprovalInput) {
  // MP preapproval only documents frequency_type: days | months (not years).
  const frequency = input.billingInterval === "year" ? 12 : 1;
  const amount = Math.round(input.amountPesos * 100) / 100;

  // Official pending-subscription examples include end_date.
  const end = new Date();
  end.setFullYear(end.getFullYear() + 2);

  return {
    frequency,
    frequency_type: "months" as const,
    transaction_amount: amount,
    currency_id: "ARS",
    end_date: end.toISOString(),
  };
}

export async function createPendingPreapproval(
  input: CreatePreapprovalInput,
): Promise<PreapprovalResult> {
  const accessToken = await getValidAccessTokenForTenant(input.tenantId);
  if (!accessToken) {
    throw new Error("Este comercio todavía no conectó Mercado Pago");
  }

  const payerEmail = input.payerEmail.trim().toLowerCase();
  const autoRecurring = buildRecurrence(input);
  const payload = {
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: payerEmail,
    auto_recurring: autoRecurring,
    back_url: input.backUrl,
    status: "pending",
  };

  console.info("[mercadopago] create preapproval request", {
    tenantId: input.tenantId,
    payerEmail,
    amount: autoRecurring.transaction_amount,
    frequency: autoRecurring.frequency,
    frequencyType: autoRecurring.frequency_type,
    endDate: autoRecurring.end_date,
    externalReference: input.externalReference,
    backUrl: input.backUrl,
    useTestToken: process.env.MP_USE_TEST_TOKEN === "true",
  });

  const response = await fetch(`${getMpApiBaseUrl()}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // Helps avoid duplicate broken checkouts on retries
      "X-Idempotency-Key": `${input.externalReference}-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as PreapprovalRemote & {
    message?: string;
    error?: string;
    cause?: Array<{ code?: string; description?: string }>;
  };

  console.info("[mercadopago] create preapproval response", {
    ok: response.ok,
    status: response.status,
    id: data.id,
    preapprovalStatus: data.status,
    liveMode: data.live_mode,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
    collectorId: data.collector_id,
    message: data.message,
    error: data.error,
    cause: data.cause,
  });

  if (!response.ok || !data.id) {
    const cause = data.cause?.[0]?.description;
    throw new Error(
      cause ||
        data.message ||
        data.error ||
        "No se pudo crear la suscripción en Mercado Pago",
    );
  }

  // Always prefer init_point. sandbox_init_point is deprecated and the
  // /checkout/v1/subscription/redirect UI often leaves Confirmar disabled.
  const initPoint = data.init_point || data.sandbox_init_point;
  if (!initPoint) {
    throw new Error("Mercado Pago no devolvió un link de pago");
  }

  if (
    process.env.MP_USE_TEST_TOKEN === "true" &&
    !payerEmail.endsWith("@testuser.com")
  ) {
    console.warn(
      "[mercadopago] test mode with non-testuser payer email; MP may reject checkout",
      { payerEmail },
    );
  }

  return {
    id: data.id,
    initPoint,
    status: data.status ?? "pending",
    liveMode: typeof data.live_mode === "boolean" ? data.live_mode : null,
    sandboxInitPoint: data.sandbox_init_point ?? null,
    productionInitPoint: data.init_point ?? null,
  };
}

export async function fetchPreapproval(
  tenantId: string,
  preapprovalId: string,
): Promise<PreapprovalRemote | null> {
  const accessToken = await getValidAccessTokenForTenant(tenantId);
  if (!accessToken) {
    return null;
  }

  const response = await fetch(
    `${getMpApiBaseUrl()}/preapproval/${preapprovalId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    console.warn("[mercadopago] fetch preapproval failed", {
      preapprovalId,
      status: response.status,
    });
    return null;
  }

  return (await response.json()) as PreapprovalRemote;
}

export function buildSubscriptionBackUrl(tenantSlug: string): string {
  return `${getAppUrl()}/app/${tenantSlug}?payment=return`;
}

export function isMpTestPayerEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@testuser.com");
}
