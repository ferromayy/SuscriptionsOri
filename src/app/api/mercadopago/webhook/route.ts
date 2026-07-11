import { NextRequest, NextResponse } from "next/server";

import { createDbClient } from "@/lib/db/client";
import { fetchPreapproval } from "@/lib/mercadopago/subscriptions";

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
  if (
    topic.includes("subscription") ||
    topic.includes("preapproval") ||
    body.action?.includes("subscription")
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

  const paymentStatus =
    remote.status === "authorized"
      ? "authorized"
      : remote.status === "paused"
        ? "paused"
        : remote.status === "cancelled"
          ? "cancelled"
          : "pending";

  const status =
    remote.status === "authorized"
      ? "active"
      : remote.status === "cancelled"
        ? "cancelled"
        : "pending_authorization";

  await db
    .from("subscriptions")
    .update({
      payment_status: paymentStatus,
      status,
    })
    .eq("id", subscription.id);
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
