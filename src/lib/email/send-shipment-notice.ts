import { Resend } from "resend";

import {
  handleResendError,
  isResendConfigured,
  logDevEmailFallback,
} from "@/lib/email/delivery";

type SendShipmentNoticeInput = {
  to: string;
  customerName: string;
  tenantName: string;
  planName: string;
  quantity: string;
  deliveryDateLabel: string;
};

export async function sendShipmentNoticeEmail(
  input: SendShipmentNoticeInput,
): Promise<{ emailSent: boolean }> {
  const firstName = input.customerName.split(" ")[0] || input.customerName;
  const subject = `${input.tenantName}: tu pedido ya salió`;
  const lines = [
    `Hola ${firstName},`,
    `Tu pedido de ${input.planName} (${input.quantity}) con fecha ${input.deliveryDateLabel} ya salió en camino.`,
    `Cualquier consulta, respondé este correo o escribinos por WhatsApp.`,
    `— ${input.tenantName}`,
  ];

  const devFallback = {
    label: "AVISO DE ENVÍO",
    to: input.to,
    lines,
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
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Tu pedido ya salió</h2>
        <p>Hola ${firstName},</p>
        <p>
          Tu pedido de <strong>${input.planName}</strong>
          (${input.quantity}) con fecha
          <strong>${input.deliveryDateLabel}</strong> ya salió en camino.
        </p>
        <p style="color: #64748b; font-size: 14px;">
          Cualquier consulta, respondé este correo o escribinos por WhatsApp.
        </p>
        <p>— ${input.tenantName}</p>
      </div>
    `,
  });

  if (error) {
    await handleResendError(error, devFallback);
    return { emailSent: false };
  }

  return { emailSent: true };
}
