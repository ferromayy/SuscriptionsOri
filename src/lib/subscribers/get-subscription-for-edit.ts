import "server-only";

import { createDbClient } from "@/lib/db/client";
import {
  normalizeBillingCycleDays,
} from "@/lib/subscribers/billing-cycle";
import type { BillingCycleDays } from "@/lib/subscribers/checkout-schemas";
import type { DeliveryMethod, PaymentMethod } from "@/types/database";

export type SubscriptionChoiceRow = {
  fieldId: string;
  optionId: string | null;
  textValue: string | null;
};

export type SubscriberSubscription = {
  id: string;
  planId: string;
  status: string;
  finalPriceCents: number | null;
  billingCycleDays: BillingCycleDays;
  createdAt: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  deliveryMethod: DeliveryMethod | null;
  deliveryDetails: Record<string, string>;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  choices: SubscriptionChoiceRow[];
};

export async function getSubscriberSubscription(
  subscriptionId: string,
  userId: string,
  tenantId: string,
): Promise<SubscriberSubscription | null> {
  const db = createDbClient();

  const { data: subscription } = await db
    .from("subscriptions")
    .select(
      "id, plan_id, status, final_price_cents, billing_cycle_days, created_at, contact_email, contact_phone, contact_first_name, contact_last_name, delivery_method, delivery_details, payment_method, payment_reference",
    )
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!subscription) {
    return null;
  }

  const { data: choices } = await db
    .from("subscription_choices")
    .select("field_id, option_id, text_value")
    .eq("subscription_id", subscription.id)
    .is("deleted_at", null);

  const details = (subscription.delivery_details ?? {}) as Record<
    string,
    string
  >;

  return {
    id: subscription.id,
    planId: subscription.plan_id,
    status: subscription.status,
    finalPriceCents: subscription.final_price_cents,
    billingCycleDays: normalizeBillingCycleDays(
      subscription.billing_cycle_days,
    ),
    createdAt: subscription.created_at,
    contactEmail: subscription.contact_email,
    contactPhone: subscription.contact_phone,
    contactFirstName: subscription.contact_first_name,
    contactLastName: subscription.contact_last_name,
    deliveryMethod: subscription.delivery_method,
    deliveryDetails: details,
    paymentMethod: subscription.payment_method,
    paymentReference: subscription.payment_reference,
    choices: (choices ?? []).map((choice) => ({
      fieldId: choice.field_id,
      optionId: choice.option_id,
      textValue: choice.text_value,
    })),
  };
}

export async function getSubscriberPlanIds(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const db = createDbClient();
  const { data } = await db
    .from("subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  return (data ?? []).map((row) => row.plan_id);
}
