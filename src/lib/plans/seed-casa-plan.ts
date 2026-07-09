import type { CreatePlanInput } from "@/lib/plans/schemas";

export function getCasaSubscriptionInput(): CreatePlanInput {
  return {
    name: "Suscripción casa",
    internalLabel: "Para casa y a definir ciertos aspectos",
    description:
      "El plan pensado para quienes buscan un buen café en su casa, mes a mes. Si querés tomarte un buen café vos y también para tu familia esto es para vos.",
    basePricePesos: 25000,
    currency: "ars",
    fieldCount: 2,
    isActive: true,
    fields: [
      {
        label: "Molienda",
        fieldType: "select",
        affectsPrice: false,
        options: [
          { label: "Café en grano" },
          { label: "Cold brew" },
          { label: "Moka/Italiana" },
          { label: "Aeropress" },
          { label: "Prensa Francesa" },
          { label: "V60" },
          { label: "Espresso" },
        ],
      },
      {
        label: "Cantidad",
        fieldType: "select",
        affectsPrice: true,
        options: [
          { label: "2 bolsas de 250gr", priceDeltaPesos: 10000 },
          { label: "4 bolsas de 250gr", priceDeltaPesos: 15000 },
          { label: "6 bolsas de 250gr", priceDeltaPesos: 20000 },
        ],
      },
    ],
  };
}
