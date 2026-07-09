"use server";

import { redirect } from "next/navigation";

import { requestPasswordReset } from "@/lib/auth/password-reset";

export type ForgotPasswordState = {
  error: string | null;
  success: string | null;
};

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  if (!email) {
    return { error: "Ingresá tu email", success: null };
  }

  const result = await requestPasswordReset(email);
  if (result.error) {
    return { error: result.error, success: null };
  }

  const params = new URLSearchParams({ email });
  if (next.startsWith("/")) {
    params.set("next", next);
  }
  redirect(`/auth/forgot-password/sent?${params.toString()}`);
}
