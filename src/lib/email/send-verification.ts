import { Resend } from "resend";

import {
  handleResendError,
  isResendConfigured,
  logDevEmailFallback,
} from "@/lib/email/delivery";

type SendVerificationInput = {
  to: string;
  code: string;
  verifyUrl: string;
  name?: string | null;
};

export async function sendVerificationEmail(
  input: SendVerificationInput,
): Promise<void> {
  const devFallback = {
    label: "CÓDIGO DE VERIFICACIÓN",
    to: input.to,
    lines: [
      `Código: ${input.code}`,
      `Pegalo en: ${input.verifyUrl}`,
    ],
  };

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "development") {
      logDevEmailFallback(devFallback);
      return;
    }
    throw new Error(
      "Configurá RESEND_API_KEY y EMAIL_FROM en las variables de entorno",
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const greeting = input.name ? `Hola ${input.name}` : "Hola";

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject: `Tu código: ${input.code} — Subscriptions Ori`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${greeting}</h2>
        <p>Ingresá este código para verificar tu email:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                  text-align: center; margin: 32px 0; color: #0f172a;">
          ${input.code}
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${input.verifyUrl}"
             style="background: #0f172a; color: #fff; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; display: inline-block;">
            Ingresar código
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">
          El código expira en 30 minutos. Si no creaste esta cuenta, ignorá este mensaje.
        </p>
      </div>
    `,
  });

  if (error) {
    await handleResendError(error, devFallback);
  }
}
