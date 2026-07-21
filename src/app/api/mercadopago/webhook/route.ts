import { NextRequest, NextResponse } from "next/server";

import { createDbClient } from "@/lib/db/client";
import {
  fetchAuthorizedPayment,
  fetchPreapproval,
  findLatestRejectionDetail,
} from "@/lib/mercadopago/subscriptions";
import type { PaymentStatus, SubscriptionStatus } from "@/types/database";

type WebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string };
};

export async function POST(request: NextRequest) {
  let body: WebhookBody = {};
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const topic = body.type || request.nextUrl.searchParams.get("topic") || "";
  const resourceId =
    body.data?.id || request.nextUrl.searchParams.get("id") || "";

  if (!resourceId) {
    return NextResponse.json({ ok: true });
  }

  // Subscription / preapproval notifications
  // Note: subscription_authorized_payment uses an invoice id, not preapproval id.
  if (
    !topic.includes("authorized_payment") &&
    (topic.includes("subscription") ||
      topic.includes("preapproval") ||
      body.action?.includes("subscription"))
  ) {
    await syncPreapprovalById(resourceId);
  }
  if (topic.includes("authorized_payment")) {
    await syncAuthorizedPaymentById(resourceId);
  }

  return NextResponse.json({ ok: true });
}

async function syncAuthorizedPaymentById(
  authorizedPaymentId: string,
): Promise<void> {
  const db = createDbClient();
  const externalId = `mp-authorized:${authorizedPaymentId}`;
  const { data: alreadyProcessed } = await db
    .from("payment_cycles")
    .select("id, status")
    .eq("external_id", externalId)
    .maybeSingle();
  if (alreadyProcessed?.status === "paid") return;

  const { data: cardSubscriptions } = await db
    .from("subscriptions")
    .select("id, tenant_id, user_id, mp_preapproval_id, final_price_cents")
    .in("payment_method", ["card_monthly", "card_annual"])
    .not("mp_preapproval_id", "is", null)
    .is("deleted_at", null);

  const tenantIds = [
    ...new Set((cardSubscriptions ?? []).map((sub) => sub.tenant_id)),
  ];
  for (const tenantId of tenantIds) {
    const remote = await fetchAuthorizedPayment(
      tenantId,
      authorizedPaymentId,
    );
    if (!remote?.preapproval_id) continue;
    const subscription = (cardSubscriptions ?? []).find(
      (sub) =>
        sub.tenant_id === tenantId &&
        sub.mp_preapproval_id === remote.preapproval_id,
    );
    if (!subscription) continue;

    const { ensureCurrentPaymentCycle, confirmPaymentCycle } = await import(
      "@/lib/payments/payment-cycles"
    );
    const cycle = await ensureCurrentPaymentCycle(subscription.id);
    if (!cycle) return;
    const paymentStatus = remote.payment?.status ?? remote.status ?? "";
    if (
      paymentStatus === "approved" ||
      paymentStatus === "authorized" ||
      paymentStatus === "processed"
    ) {
      const result = await confirmPaymentCycle({
        cycleId: cycle.id,
        tenantId,
        externalId,
        source: "card",
      });
      if ("error" in result) {
        console.error("[mercadopago] recurring cycle confirmation failed", {
          authorizedPaymentId,
          error: result.error,
        });
      }
      return;
    }

    if (
      paymentStatus === "rejected" ||
      paymentStatus === "cancelled"
    ) {
      await db
        .from("payment_cycles")
        .update({
          status: "failed",
          external_id: externalId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cycle.id);
      await db
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", subscription.id);
      const { recordPaymentEvent } = await import(
        "@/lib/payments/payment-events"
      );
      await recordPaymentEvent({
        tenantId,
        subscriptionId: subscription.id,
        userId: subscription.user_id,
        source: "card",
        kind: "rejected",
        amountCents: cycle.amountCents,
        billingCycleDays: 30,
        dueOn: cycle.dueOn,
        paidAt: null,
        externalId,
        notes:
          remote.payment?.status_detail ??
          "Cobro recurrente rechazado por Mercado Pago",
      });
      return;
    }
  }

  console.warn("[mercadopago] authorized payment could not be matched", {
    authorizedPaymentId,
  });
}

async function syncPreapprovalById(preapprovalId: string): Promise<void> {
  const db = createDbClient();
  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, tenant_id, user_id, mp_preapproval_id, status")
    .eq("mp_preapproval_id", preapprovalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!subscription) {
    return;
  }

  const remote = await fetchPreapproval(subscription.tenant_id, preapprovalId);
  if (!remote) {
    return;
  }

  const paymentStatus: PaymentStatus =
    remote.status === "authorized"
      ? "authorized"
      : remote.status === "paused"
        ? "paused"
        : remote.status === "cancelled"
          ? "cancelled"
          : "pending";

  const status: SubscriptionStatus =
    remote.status === "authorized"
      ? "active"
      : remote.status === "cancelled"
        ? "cancelled"
        : "pending_authorization";

  const update: {
    payment_status: PaymentStatus;
    status: SubscriptionStatus;
    mp_last_rejection_detail?: string;
    mp_last_rejection_at?: string;
  } = {
    payment_status: paymentStatus,
    status,
  };

  if (remote.status === "cancelled") {
    const rejection = await findLatestRejectionDetail(
      subscription.tenant_id,
      preapprovalId,
    );

    if (rejection) {
      console.warn("[mercadopago] preapproval cancelled after rejected payment", {
        preapprovalId,
        externalReference:
          rejection.externalReference ?? remote.external_reference ?? null,
        statusDetail: rejection.statusDetail,
        paymentStatus: rejection.paymentStatus,
        paymentId: rejection.paymentId,
        invoiceId: rejection.invoiceId,
        subscriptionId: subscription.id,
      });
      update.mp_last_rejection_detail = rejection.statusDetail;
      update.mp_last_rejection_at = new Date().toISOString();
    } else {
      console.warn(
        "[mercadopago] preapproval cancelled without rejection detail",
        {
          preapprovalId,
          externalReference: remote.external_reference ?? null,
          subscriptionId: subscription.id,
        },
      );
    }
  }

  const { error: updateError } = await db
    .from("subscriptions")
    .update(update)
    .eq("id", subscription.id);

  if (updateError) {
    console.error("[mercadopago] webhook subscription update failed", {
      preapprovalId,
      subscriptionId: subscription.id,
      error: updateError.message,
    });

    if (update.mp_last_rejection_detail) {
      const { error: fallbackError } = await db
        .from("subscriptions")
        .update({ payment_status: paymentStatus, status })
        .eq("id", subscription.id);
      if (fallbackError) {
        console.error("[mercadopago] webhook fallback update failed", {
          preapprovalId,
          subscriptionId: subscription.id,
          error: fallbackError.message,
        });
      }
    }
  }

  if (status === "active") {
    const { ensureSubscriberMembership } = await import(
      "@/lib/subscribers/ensure-subscriber-membership"
    );
    const membership = await ensureSubscriberMembership(
      subscription.user_id,
      subscription.tenant_id,
      "public_signup",
    );
    if ("error" in membership) {
      console.error("[mercadopago] webhook membership failed", {
        subscriptionId: subscription.id,
        error: membership.error,
      });
    }

    const { recordConfirmedSubscriptionPayment } = await import(
      "@/lib/payments/payment-events"
    );
    const paymentRecord = await recordConfirmedSubscriptionPayment(
      subscription.id,
    );
    if ("error" in paymentRecord) {
      console.error("[mercadopago] webhook payment ledger failed", {
        subscriptionId: subscription.id,
        error: paymentRecord.error,
      });
    }
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
