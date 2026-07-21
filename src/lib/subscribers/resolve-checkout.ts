import "server-only";

import {
  checkoutDetailsSchema,
  type CheckoutDetailsInput,
} from "@/lib/subscribers/checkout-schemas";
import {
  receiptFileFromFormData,
  uploadPaymentReceipt,
} from "@/lib/storage/payment-receipts";

/**
 * Reads checkout JSON from FormData, uploads an optional receipt file,
 * then validates. For transfers, number and/or receipt are required.
 */
export async function resolveCheckoutFromFormData(
  formData: FormData,
  tenantId: string,
): Promise<{ error: string } | { data: CheckoutDetailsInput }> {
  const raw = formData.get("checkout");
  if (!raw || typeof raw !== "string") {
    return { error: "Completá contacto, entrega y pago" };
  }

  let draft: unknown;
  try {
    draft = JSON.parse(raw);
  } catch {
    return { error: "No se pudieron leer los datos de checkout" };
  }

  if (!draft || typeof draft !== "object") {
    return { error: "Datos de checkout inválidos" };
  }

  const checkout = { ...(draft as Record<string, unknown>) };
  const file = receiptFileFromFormData(formData);

  if (file) {
    const uploaded = await uploadPaymentReceipt({ tenantId, file });
    if ("error" in uploaded) {
      return { error: uploaded.error };
    }
    checkout.paymentReceiptPath = uploaded.path;
  }

  const result = checkoutDetailsSchema.safeParse(checkout);
  if (!result.success) {
    return {
      error:
        result.error.issues[0]?.message ?? "Completá contacto, entrega y pago",
    };
  }

  return { data: result.data };
}
