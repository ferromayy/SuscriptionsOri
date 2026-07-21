import { Resend } from "resend";

import {
  handleResendError,
  isResendConfigured,
  logDevEmailFallback,
} from "@/lib/email/delivery";

export async function sendPaymentReminderEmail(input: {
  to: string;
  customerName: string;
  tenantName: string;
  planName: string;
  amountLabel: string;
  dueDateLabel: string;
  accountUrl: string;
}): Promise<{ emailSent: boolean }> {
  const firstName = input.customerName.split(" ")[0] || input.customerName;
  const subject = `${input.tenantName}: recordatorio de pago`;
  const lines = [
    `Hola ${firstName},`,
    `Tu próximo pago de ${input.planName} por ${input.amountLabel} vence el ${input.dueDateLabel}.`,
    `Podés subir el comprobante desde ${input.accountUrl}.`,
    "El pedido se prepara una vez confirmado el pago.",
  ];
  const fallback = {
    label: "RECORDATORIO DE PAGO",
    to: input.to,
    lines,
  };

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "development") {
      logDevEmailFallback(fallback);
      return { emailSent: false };
    }
    return { emailSent: false };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <p style="color:#2563eb;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;">Próximo pago</p>
        <h2>Recordatorio de pago</h2>
        <p>Hola ${firstName},</p>
        <p>
          Tu próximo pago de <strong>${input.planName}</strong> por
          <strong>${input.amountLabel}</strong> vence el
          <strong>${input.dueDateLabel}</strong>.
        </p>
        <p>
          Podés enviar el comprobante por WhatsApp o
          <a href="${input.accountUrl}">subirlo desde tu cuenta</a>.
        </p>
        <p style="color:#64748b;font-size:14px;">
          Los pedidos se preparan una vez confirmado el pago.
        </p>
        <p>— ${input.tenantName}</p>
      </div>
    `,
  });
  if (error) {
    await handleResendError(error, fallback);
    return { emailSent: false };
  }
  return { emailSent: true };
}
