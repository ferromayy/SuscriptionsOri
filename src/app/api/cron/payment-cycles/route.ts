import { NextRequest, NextResponse } from "next/server";

import {
  sendDuePaymentReminderEmails,
  syncPaymentCycles,
} from "@/lib/payments/payment-cycles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cycles = await syncPaymentCycles();
  const reminders = await sendDuePaymentReminderEmails();
  return NextResponse.json({ ok: true, cycles, reminders });
}
