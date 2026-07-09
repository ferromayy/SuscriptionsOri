import "server-only";

import { createDbClient } from "@/lib/db/client";

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
    .select("id, plan_id, status, final_price_cents")
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

  return {
    id: subscription.id,
    planId: subscription.plan_id,
    status: subscription.status,
    finalPriceCents: subscription.final_price_cents,
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
