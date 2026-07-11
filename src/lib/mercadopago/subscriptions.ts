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
};

export async function createPendingPreapproval(
  input: CreatePreapprovalInput,
): Promise<PreapprovalResult> {
  const accessToken = await getValidAccessTokenForTenant(input.tenantId);
  if (!accessToken) {
    throw new Error("Este comercio todavía no conectó Mercado Pago");
  }

  const frequencyType = input.billingInterval === "year" ? "years" : "months";

  const response = await fetch(`${getMpApiBaseUrl()}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: frequencyType,
        transaction_amount: input.amountPesos,
        currency_id: "ARS",
      },
      back_url: input.backUrl,
      status: "pending",
    }),
  });

  const data = (await response.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
    status?: string;
    message?: string;
    error?: string;
    cause?: Array<{ code?: string; description?: string }>;
  };

  if (!response.ok || !data.id) {
    const cause = data.cause?.[0]?.description;
    throw new Error(
      cause || data.message || data.error || "No se pudo crear la suscripción en Mercado Pago",
    );
  }

  const useTestToken = process.env.MP_USE_TEST_TOKEN === "true";
  const initPoint = useTestToken
    ? data.sandbox_init_point || data.init_point
    : data.init_point || data.sandbox_init_point;

  if (!initPoint) {
    throw new Error("Mercado Pago no devolvió un link de pago");
  }

  return {
    id: data.id,
    initPoint,
    status: data.status ?? "pending",
  };
}

export async function fetchPreapproval(
  tenantId: string,
  preapprovalId: string,
): Promise<{ id: string; status: string; external_reference?: string } | null> {
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
    return null;
  }

  return (await response.json()) as {
    id: string;
    status: string;
    external_reference?: string;
  };
}

export function buildSubscriptionBackUrl(tenantSlug: string): string {
  return `${getAppUrl()}/app/${tenantSlug}?payment=return`;
}
