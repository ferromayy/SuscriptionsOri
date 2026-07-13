import { NextRequest, NextResponse } from "next/server";

import { createDbClient } from "@/lib/db/client";
import {
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

  return NextResponse.json({ ok: true });
}

async function syncPreapprovalById(preapprovalId: string): Promise<void> {
  const db = createDbClient();
  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, tenant_id, mp_preapproval_id, status")
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

    // If the rejection-detail columns are missing (migration not applied),
    // still persist the critical status fields.
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
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
