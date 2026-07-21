import "server-only";

import { passwordSchema } from "@/lib/auth/schemas";
import { createUser, findUserByEmail } from "@/lib/auth/session";
import {
  otherOrganizationErrorMessage,
  userHasActiveMembershipInOtherTenant,
} from "@/lib/auth/user-cleanup";
import { createDbClient } from "@/lib/db/client";
import type { FieldChoiceInput } from "@/lib/plans/schemas";
import {
  checkoutDetailsSchema,
  type CheckoutDetailsInput,
} from "@/lib/subscribers/checkout-schemas";
import { ensureSubscriberMembership } from "@/lib/subscribers/ensure-subscriber-membership";
import { upsertSubscriberSubscription } from "@/lib/subscribers/join-subscriber";
import { recordConfirmedSubscriptionPayment } from "@/lib/payments/payment-events";

export type CreateManagedSubscriberInput = {
  tenantId: string;
  tenantSlug: string;
  email: string;
  /** Required for signup only — managers never change an existing password. */
  password?: string | null;
  fullName?: string | null;
  authMode: "signup" | "login";
  existingUserId?: string | null;
  planId: string;
  fieldChoices: FieldChoiceInput[];
  checkout: CheckoutDetailsInput;
};

export type CreateManagedSubscriberResult =
  | {
      ok: true;
      userId: string;
      subscriptionId: string;
      createdUser: boolean;
    }
  | { error: string };

/**
 * Public join flow run by a tenant manager.
 * Subscriber membership is created only when the subscription becomes active
 * (transfer is confirmed immediately in this flow).
 */
export async function createManagedSubscriber(
  input: CreateManagedSubscriberInput,
): Promise<CreateManagedSubscriberResult> {
  const email = input.email.trim().toLowerCase();

  const checkoutResult = checkoutDetailsSchema.safeParse({
    ...input.checkout,
    email,
    paymentReference:
      input.checkout.paymentReference?.trim() || "Confirmado por el comercio",
    paymentMethod: input.checkout.paymentMethod || "transfer",
  });

  if (!checkoutResult.success) {
    return {
      error:
        checkoutResult.error.issues[0]?.message ??
        "Completá los datos de contacto y entrega",
    };
  }

  const checkout = checkoutResult.data;
  const db = createDbClient();

  let userId: string;
  let createdUser = false;

  if (input.existingUserId) {
    const { data: member } = await db
      .from("tenant_members")
      .select("id, role")
      .eq("tenant_id", input.tenantId)
      .eq("user_id", input.existingUserId)
      .eq("role", "subscriber")
      .is("deleted_at", null)
      .maybeSingle();

    if (!member) {
      // May still be a pending (unpaid) user without membership — allow by user id.
      const { data: user } = await db
        .from("users")
        .select("id")
        .eq("id", input.existingUserId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!user) {
        return { error: "El suscriptor no pertenece a esta organización" };
      }
    }

    userId = input.existingUserId;
  } else if (input.authMode === "login") {
    const existing = await findUserByEmail(email);
    if (!existing) {
      return { error: "No hay una cuenta con ese email. Usá Crear cuenta." };
    }

    if (await userHasActiveMembershipInOtherTenant(existing.id, input.tenantId)) {
      return { error: otherOrganizationErrorMessage() };
    }

    const { data: member } = await db
      .from("tenant_members")
      .select("id, role")
      .eq("tenant_id", input.tenantId)
      .eq("user_id", existing.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (member && member.role !== "subscriber") {
      return {
        error:
          "Ese email pertenece a un administrador de esta organización. Usá otro email.",
      };
    }

    userId = existing.id;
  } else {
    const passwordCheck = passwordSchema.safeParse(input.password ?? "");
    if (!passwordCheck.success) {
      return {
        error:
          passwordCheck.error.issues[0]?.message ??
          "Definí una contraseña para la cuenta nueva",
      };
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return {
        error: "Ese email ya tiene cuenta. Usá la opción «Ya tiene cuenta».",
      };
    }

    const fullName =
      input.fullName?.trim() ||
      `${checkout.firstName} ${checkout.lastName}`.trim();

    try {
      const user = await createUser({
        email,
        password: passwordCheck.data,
        fullName,
      });
      userId = user.id;
      createdUser = true;

      await db
        .from("users")
        .update({ email_verified_at: new Date().toISOString() })
        .eq("id", user.id);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la cuenta del suscriptor",
      };
    }
  }

  const { data: existingMember } = await db
    .from("tenant_members")
    .select("id, role")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingMember && existingMember.role !== "subscriber") {
    return {
      error:
        "Ese email pertenece a un administrador. No se puede dar de alta como suscriptor.",
    };
  }

  const subscriptionResult = await upsertSubscriberSubscription(
    userId,
    input.tenantId,
    input.tenantSlug,
    input.planId,
    input.fieldChoices,
    checkout,
    { skipTransferAccountCheck: true },
  );

  if ("error" in subscriptionResult) {
    return { error: subscriptionResult.error };
  }

  if (checkout.paymentMethod === "transfer") {
    const { error: activateError } = await db
      .from("subscriptions")
      .update({
        status: "active",
        payment_status: "authorized",
      })
      .eq("id", subscriptionResult.subscriptionId)
      .eq("tenant_id", input.tenantId);

    if (activateError) {
      return { error: activateError.message };
    }

    const membership = await ensureSubscriberMembership(
      userId,
      input.tenantId,
      "client_invite",
    );
    if ("error" in membership) {
      return { error: membership.error };
    }

    await recordConfirmedSubscriptionPayment(subscriptionResult.subscriptionId);
  }

  return {
    ok: true,
    userId,
    subscriptionId: subscriptionResult.subscriptionId,
    createdUser,
  };
}
