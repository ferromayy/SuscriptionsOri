import type {
  DeliveryMethod,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@/types/database";

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "pending_payment":
      return "Pendiente de pago";
    case "pending_authorization":
      return "Pendiente de autorización";
    case "trialing":
      return "En prueba";
    case "active":
      return "Activa";
    case "past_due":
      return "Vencida";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

export function paymentStatusLabel(status: PaymentStatus | null): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "authorized":
      return "Autorizado";
    case "paused":
      return "Pausado";
    case "cancelled":
      return "Cancelado";
    default:
      return "—";
  }
}

export function paymentMethodLabel(method: PaymentMethod | null): string {
  switch (method) {
    case "transfer":
      return "Transferencia";
    case "card_monthly":
      return "Tarjeta mensual";
    case "card_annual":
      return "Tarjeta anual";
    default:
      return "—";
  }
}

export function deliveryMethodLabel(method: DeliveryMethod | null): string {
  switch (method) {
    case "shipping":
      return "Envío a domicilio";
    case "andreani":
      return "Andreani";
    case "store_pickup":
      return "Retiro en tienda";
    default:
      return "—";
  }
}
