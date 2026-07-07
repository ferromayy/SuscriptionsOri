"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { revalidateAdmin } from "@/lib/admin/revalidate";
import { verifyEmailCode } from "@/lib/auth/email-verification";
import { establishSession } from "@/lib/auth/cookies";

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

  revalidateAdmin();
  await establishSession(result.userId);

  if (result.redirectTo) {
    redirect(result.redirectTo);
  }

  redirect("/auth/login?verified=1");
}
