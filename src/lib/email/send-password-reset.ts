import { Resend } from "resend";

import {
  handleResendError,
  isResendConfigured,
  logDevEmailFallback,
} from "@/lib/email/delivery";

type SendPasswordResetInput = {
  to: string;
  resetUrl: string;
  name?: string | null;
};

export async function sendPasswordResetEmail(
  input: SendPasswordResetInput,
): Promise<void> {
  const devFallback = {
    label: "RECUPERAR CONTRASEÑA",
    to: input.to,
    lines: [`Link: ${input.resetUrl}`],
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
    subject: "Recuperá tu contraseña — Subscriptions Ori",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${greeting}</h2>
        <p>Recibimos un pedido para restablecer tu contraseña.</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${input.resetUrl}"
             style="background: #111827; color: #fff; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; display: inline-block;">
            Elegir nueva contraseña
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">
          El link expira en 30 minutos. Si no pediste esto, ignorá este mensaje.
        </p>
      </div>
    `,
  });

  if (error) {
    await handleResendError(error, devFallback);
  }
}
