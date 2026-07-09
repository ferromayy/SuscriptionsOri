"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { establishSession } from "@/lib/auth/cookies";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";
import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { passwordSchema } from "@/lib/auth/schemas";

export type ResetPasswordState = {
  error: string | null;
};

const schema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.password?.[0] ??
      "Completá todos los campos";
    return { error: message };
  }

  const confirm = String(formData.get("confirmPassword") ?? "");
  if (parsed.data.password !== confirm) {
    return { error: "Las contraseñas no coinciden" };
  }

  const result = await resetPasswordWithToken(
    parsed.data.token,
    parsed.data.password,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  await establishSession(result.userId);

  const next = String(formData.get("next") ?? "/");
  const destination = await resolvePostLoginRedirect(result.userId, next);
  redirect(`${destination}?reset=1`);
}
