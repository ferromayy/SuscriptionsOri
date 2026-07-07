import { Resend } from "resend";

import {
  handleResendError,
  isResendConfigured,
  logDevEmailFallback,
} from "@/lib/email/delivery";

type SendClientInviteInput = {
  to: string;
  code: string;
  inviteUrl: string;
  tenantName: string;
};

export type ClientInviteDelivery = {
  emailSent: boolean;
};

export async function sendClientInviteEmail(
  input: SendClientInviteInput,
): Promise<ClientInviteDelivery> {
  const devFallback = {
    label: "INVITACIÓN CLIENTE",
    to: input.to,
    lines: [
      `Organización: ${input.tenantName}`,
      `Código: ${input.code}`,
      `Link: ${input.inviteUrl}`,
    ],
  };

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "development") {
      logDevEmailFallback(devFallback);
      return { emailSent: false };
    }
    throw new Error(
      "Configurá RESEND_API_KEY y EMAIL_FROM para enviar emails",
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject: `Invitación a ${input.tenantName} — código ${input.code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Te invitaron a ${input.tenantName}</h2>
        <p>Fuiste invitado como administrador en Subscriptions Ori.</p>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                  text-align: center; margin: 24px 0; color: #0f172a;">
          ${input.code}
        </p>
        <p style="text-align: center;">
          <a href="${input.inviteUrl}"
             style="background: #0f172a; color: #fff; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; display: inline-block;
                    font-weight: 600;">
            Abrir invitación e ingresar código
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
          Al hacer clic en el botón, ingresá el código de 6 dígitos para crear
          tu cuenta y activar tu organización.
        </p>
      </div>
    `,
  });

  if (error) {
    await handleResendError(error, devFallback);
    return { emailSent: false };
  }

  return { emailSent: true };
}
