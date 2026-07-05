"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { verifyEmailCode } from "@/lib/auth/email-verification";
import { setSessionCookie } from "@/lib/auth/cookies";
import { createSession } from "@/lib/auth/session";

export type VerifyCodeState = {
  error: string | null;
};

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

export async function verifyCodeAction(
  _prev: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    code: String(formData.get("code") ?? "").replace(/\s/g, ""),
  });

  if (!parsed.success) {
    return { error: "Ingresá un email válido y el código de 6 dígitos" };
  }

  const result = await verifyEmailCode(parsed.data.email, parsed.data.code);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/tenants");
  revalidatePath("/admin");

  const sessionToken = await createSession(result.userId);
  await setSessionCookie(sessionToken);

  if (result.tenantSlug) {
    redirect(`/app/${result.tenantSlug}/onboarding`);
  }

  redirect("/auth/login?verified=1");
}
