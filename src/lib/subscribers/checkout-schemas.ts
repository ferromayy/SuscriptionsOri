import { z } from "zod";

import {
  ARGENTINE_POSTAL_CODE_ERROR,
  isValidArgentinePostalCode,
  normalizeArgentinePostalCode,
} from "@/lib/subscribers/argentine-postal-code";

export const deliveryMethodSchema = z.enum([
  "shipping",
  "andreani",
  "store_pickup",
]);

export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>;

export const paymentMethodSchema = z.enum([
  "card_monthly",
  "card_annual",
  "transfer",
]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const billingCycleDaysSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
]);

export type BillingCycleDays = z.infer<typeof billingCycleDaysSchema>;

const argentinePostalCodeSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el código postal")
  .transform(normalizeArgentinePostalCode)
  .refine(isValidArgentinePostalCode, ARGENTINE_POSTAL_CODE_ERROR);

const provinceSchema = z.string().trim().min(1, "Elegí la provincia");

const shippingDetailsSchema = z.object({
  province: provinceSchema,
  locality: z.string().trim().min(1, "Ingresá la localidad"),
  neighborhood: z.string().trim().optional(),
  postalCode: argentinePostalCodeSchema,
  address: z.string().trim().min(1, "Ingresá la dirección"),
  apartment: z.string().trim().optional(),
});

const andreaniDetailsSchema = z.object({
  province: provinceSchema,
  locality: z.string().trim().min(1, "Ingresá la localidad"),
  postalCode: argentinePostalCodeSchema,
  address: z.string().trim().min(1, "Ingresá la dirección de la sucursal"),
  number: z.string().trim().min(1, "Ingresá el número"),
});

export const checkoutDetailsSchema = z
  .object({
    email: z.string().email("Email inválido"),
    phone: z.string().trim().min(6, "Ingresá un teléfono válido"),
    firstName: z.string().trim().min(1, "Ingresá tu nombre"),
    lastName: z.string().trim().min(1, "Ingresá tu apellido"),
    deliveryMethod: deliveryMethodSchema,
    deliveryDetails: z.record(z.string(), z.string()).default({}),
    /** How often to deliver / charge: every 15, 30, or 45 days. */
    billingCycleDays: billingCycleDaysSchema,
    paymentMethod: paymentMethodSchema,
    /** Número de operación / transacción bancaria. */
    paymentReference: z.string().trim().optional(),
    /** Path in Supabase Storage for the uploaded receipt. */
    paymentReceiptPath: z.string().trim().optional(),
    /** Email of the Mercado Pago account used to pay (can differ from Ori email). */
    mpPayerEmail: z.string().trim().email("Email de Mercado Pago inválido").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === "store_pickup") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Retiro en tienda amiga estará disponible próximamente",
        path: ["deliveryMethod"],
      });
      return;
    }

    if (data.deliveryMethod === "shipping") {
      const parsed = shippingDetailsSchema.safeParse(data.deliveryDetails);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsed.error.issues[0]?.message ?? "Completá los datos de envío",
          path: ["deliveryDetails"],
        });
      }
    }

    if (data.deliveryMethod === "andreani") {
      const parsed = andreaniDetailsSchema.safeParse(data.deliveryDetails);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            parsed.error.issues[0]?.message ??
            "Completá los datos de la sucursal Andreani",
          path: ["deliveryDetails"],
        });
      }
    }

    if (data.paymentMethod === "transfer") {
      const hasReference = Boolean(data.paymentReference?.trim());
      const hasReceipt = Boolean(data.paymentReceiptPath?.trim());
      if (!hasReference && !hasReceipt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Indicá el número de operación y/o subí el comprobante de transferencia",
          path: ["paymentReference"],
        });
      }
    }

    if (
      (data.paymentMethod === "card_monthly" ||
        data.paymentMethod === "card_annual") &&
      (!data.mpPayerEmail || data.mpPayerEmail.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresá el email de tu cuenta de Mercado Pago",
        path: ["mpPayerEmail"],
      });
    }
  });

export type CheckoutDetailsInput = z.infer<typeof checkoutDetailsSchema>;

export function resolveMpPayerEmail(checkout: CheckoutDetailsInput): string {
  return (checkout.mpPayerEmail || checkout.email).trim().toLowerCase();
}

export function normalizeDeliveryDetails(
  method: DeliveryMethod,
  details: Record<string, string>,
): Record<string, string> {
  if (method === "shipping") {
    return {
      province: details.province?.trim() ?? "",
      locality: details.locality?.trim() ?? "",
      neighborhood: details.neighborhood?.trim() ?? "",
      postalCode: normalizeArgentinePostalCode(details.postalCode ?? ""),
      address: details.address?.trim() ?? "",
      apartment: details.apartment?.trim() ?? "",
    };
  }

  if (method === "andreani") {
    return {
      province: details.province?.trim() ?? "",
      locality: details.locality?.trim() ?? "",
      postalCode: normalizeArgentinePostalCode(details.postalCode ?? ""),
      address: details.address?.trim() ?? "",
      number: details.number?.trim() ?? "",
    };
  }

  return {};
}

export function billingIntervalFromPaymentMethod(
  method: PaymentMethod,
): "month" | "year" | null {
  if (method === "card_monthly") {
    return "month";
  }
  if (method === "card_annual") {
    return "year";
  }
  return null;
}
