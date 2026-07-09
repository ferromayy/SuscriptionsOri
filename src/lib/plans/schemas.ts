import { z } from "zod";

const fieldOptionSchema = z.object({
  label: z.string().trim().min(1, "Cada opción necesita un nombre"),
  priceDeltaPesos: z.number().min(0).optional(),
});

const planFieldSchema = z.object({
  label: z.string().trim().min(1, "Cada campo necesita un nombre"),
  fieldType: z.enum(["select", "text"]),
  affectsPrice: z.boolean(),
  options: z.array(fieldOptionSchema).optional(),
});

export const createPlanSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá un nombre"),
    internalLabel: z.string().trim().optional(),
    description: z.string().trim().optional(),
    basePricePesos: z.number().min(0, "El precio no puede ser negativo"),
    currency: z.literal("ars"),
    fieldCount: z.number().int().min(1).max(5),
    fields: z.array(planFieldSchema),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.fields.length !== data.fieldCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Definí exactamente ${data.fieldCount} campos`,
        path: ["fields"],
      });
    }

    data.fields.forEach((field, index) => {
      if (field.fieldType === "select") {
        if (!field.options || field.options.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Agregá al menos una opción al desplegable",
            path: ["fields", index, "options"],
          });
        }

        if (field.affectsPrice) {
          field.options?.forEach((option, optionIndex) => {
            if (
              option.priceDeltaPesos === undefined ||
              option.priceDeltaPesos < 0
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Indicá cuánto suma cada opción al precio",
                path: ["fields", index, "options", optionIndex, "priceDeltaPesos"],
              });
            }
          });
        }
      }

      if (field.fieldType === "text" && field.affectsPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Los campos de texto no pueden modificar el precio",
          path: ["fields", index, "affectsPrice"],
        });
      }
    });
  });

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const fieldChoiceSchema = z.object({
  fieldId: z.string().uuid(),
  optionId: z.string().uuid().optional(),
  textValue: z.string().trim().min(1).optional(),
});

export const joinChoicesSchema = z.array(fieldChoiceSchema).min(0);

export type FieldChoiceInput = z.infer<typeof fieldChoiceSchema>;
