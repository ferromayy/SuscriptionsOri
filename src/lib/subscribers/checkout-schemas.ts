import { z } from "zod";

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

const shippingDetailsSchema = z.object({
  province: z.string().trim().min(1, "Ingresá la provincia"),
  neighborhood: z.string().trim().min(1, "Ingresá el barrio"),
  postalCode: z.string().trim().min(1, "Ingresá el código postal"),
  address: z.string().trim().min(1, "Ingresá la dirección"),
  apartment: z.string().trim().optional(),
});

const andreaniDetailsSchema = z.object({
  postalCode: z
    .string()
    .trim()
    .min(1, "Ingresá el código postal para elegir tu sucursal"),
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
    paymentMethod: paymentMethodSchema,
    paymentReference: z.string().trim().optional(),
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

    if (
      data.paymentMethod === "transfer" &&
      (!data.paymentReference || data.paymentReference.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indicá una referencia o comprobante de transferencia",
        path: ["paymentReference"],
      });
    }
  });

export type CheckoutDetailsInput = z.infer<typeof checkoutDetailsSchema>;

export function normalizeDeliveryDetails(
  method: DeliveryMethod,
  details: Record<string, string>,
): Record<string, string> {
  if (method === "shipping") {
    return {
      province: details.province?.trim() ?? "",
      neighborhood: details.neighborhood?.trim() ?? "",
      postalCode: details.postalCode?.trim() ?? "",
      address: details.address?.trim() ?? "",
      apartment: details.apartment?.trim() ?? "",
    };
  }

  if (method === "andreani") {
    return {
      postalCode: details.postalCode?.trim() ?? "",
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
