import Link from "next/link";
import { redirect } from "next/navigation";

import { TransferPaymentGuide } from "@/components/payments/transfer-payment-guide";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole } from "@/lib/auth/permissions";
import { createDbClient } from "@/lib/db/client";
import { formatCents } from "@/lib/plans/money";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export default async function PendingSubscriptionPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/app/${tenantSlug}/pendiente`)}`);
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.status !== "active") {
    redirect("/");
  }

  const role = await getTenantRole(user.id, tenant.id);
  if (role === "subscriber" || role === "owner" || role === "admin") {
    redirect(`/app/${tenant.slug}`);
  }

  const db = createDbClient();
  const { data: subscriptions } = await db
    .from("subscriptions")
    .select(
      "id, status, plan_id, final_price_cents, payment_method, payment_reference, created_at",
    )
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .in("status", ["pending_payment", "pending_authorization"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!subscriptions?.length) {
    redirect(`/app/${tenant.slug}/join`);
  }

  const planIds = [...new Set(subscriptions.map((s) => s.plan_id))];
  const plansById = new Map<string, { name: string; currency: string }>();
  if (planIds.length > 0) {
    const { data: plans } = await db
      .from("plans")
      .select("id, name, currency")
      .in("id", planIds)
      .is("deleted_at", null);
    for (const plan of plans ?? []) {
      plansById.set(plan.id, { name: plan.name, currency: plan.currency });
    }
  }

  return (
    <div className="ori-container py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Pago pendiente</h1>
      <p className="ori-subtitle mt-4">
        Todavía no estás registrado como suscriptor. Eso pasa cuando se confirma
        el primer pago. Mientras tanto, tu solicitud quedó en espera.
      </p>

      <ul className="mt-8 space-y-4">
        {subscriptions.map((subscription) => {
          const plan = plansById.get(subscription.plan_id);
          const isTransfer = subscription.payment_method === "transfer";

          return (
            <li key={subscription.id} className="ori-card space-y-2 text-sm">
              <p className="text-lg font-medium text-gray-900">
                {plan?.name ?? "Suscripción"}
              </p>
              <p className="text-gray-600">
                {formatCents(
                  subscription.final_price_cents ?? 0,
                  plan?.currency ?? "ars",
                )}
              </p>
              {isTransfer ? (
                <>
                  <p className="text-gray-700">
                    Estamos esperando la confirmación de tu transferencia
                    {subscription.payment_reference
                      ? ` (op. ${subscription.payment_reference})`
                      : ""}
                    . Cuando el comercio la confirme, tu cuenta quedará
                    registrada y la suscripción activa.
                  </p>
                  <TransferPaymentGuide tenantSlug={tenant.slug} />
                </>
              ) : (
                <p className="text-gray-700">
                  Falta autorizar el cobro. Cuando Mercado Pago lo confirme, vas
                  a quedar registrado como suscriptor.
                </p>
              )}
              <p className="text-xs text-gray-500">
                {new Date(subscription.created_at).toLocaleString("es-AR")}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-gray-600">
        Sesión: {user.email}. Si necesitás ayuda, contactá al comercio.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-gray-700 underline-offset-4 hover:underline">
        Ir al inicio
      </Link>
    </div>
  );
}
