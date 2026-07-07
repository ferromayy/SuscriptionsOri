type DevEmailPayload = {
  label: string;
  to: string;
  lines: string[];
};

export function logDevEmailFallback(payload: DevEmailPayload): void {
  console.log(`\n--- ${payload.label} (dev, sin email real) ---`);
  console.log(`Para: ${payload.to}`);
  for (const line of payload.lines) {
    console.log(line);
  }
  console.log(
    "Configurá RESEND_API_KEY válida en .env.local para enviar emails reales.",
  );
  console.log("----------------------------------------------\n");
}

export function isResendConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return false;
  }

  if (apiKey === "re_..." || apiKey.includes("your-api-key")) {
    return false;
  }

  return true;
}

export async function handleResendError(
  error: { message: string },
  devFallback: DevEmailPayload,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[email] Resend: ${error.message}`);
    logDevEmailFallback(devFallback);
    return;
  }

  if (error.message.toLowerCase().includes("api key")) {
    throw new Error(
      "No se pudo enviar el email: la API key de Resend no es válida. Revisá RESEND_API_KEY en las variables de entorno.",
    );
  }

  throw new Error(error.message);
}
