import { cookies } from "next/headers";

import type { CheckoutDetailsInput } from "@/lib/subscribers/checkout-schemas";

export const PENDING_SIGNUP_COOKIE = "pending_public_signup";

const MAX_AGE_SECONDS = 60 * 30;

export type PendingPublicSignup = {
  tenantSlug: string;
  planId: string;
  fieldChoices: Array<{
    fieldId: string;
    optionId?: string;
    textValue?: string;
  }>;
  checkout: CheckoutDetailsInput;
};

export async function setPendingPublicSignup(
  data: PendingPublicSignup,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SIGNUP_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getPendingPublicSignup(): Promise<PendingPublicSignup | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_SIGNUP_COOKIE)?.value;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingPublicSignup;
    if (
      !parsed.tenantSlug ||
      !parsed.planId ||
      !Array.isArray(parsed.fieldChoices) ||
      !parsed.checkout
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingPublicSignup(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SIGNUP_COOKIE);
}
