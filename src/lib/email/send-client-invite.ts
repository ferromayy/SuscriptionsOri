import { Resend } from "resend";

type SendClientInviteInput = {
  to: string;
  code: string;
  inviteUrl: string;
  tenantName: string;
};

export type ClientInviteDelivery = {
  /** true si Resend envió el email; false si solo se registró en consola (dev). */
  emailSent: boolean;
};

export async function sendClientInviteEmail(
  input: SendClientInviteInput,
): Promise<ClientInviteDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "development") {
      console.log("\n--- INVITACIÓN CLIENTE (dev, sin Resend) ---");
      console.log(`Para: ${input.to}`);
      console.log(`Organización: ${input.tenantName}`);
      console.log(`Código: ${input.code}`);
      console.log(`Link: ${input.inviteUrl}`);
      console.log(
        "Configurá RESEND_API_KEY y EMAIL_FROM en .env.local para enviar emails reales.",
      );
      console.log("----------------------------------------------\n");
      return { emailSent: false };
    }
    throw new Error(
      "Configurá RESEND_API_KEY y EMAIL_FROM para enviar emails",
    );
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
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
    throw new Error(error.message);
  }

  return { emailSent: true };
}
