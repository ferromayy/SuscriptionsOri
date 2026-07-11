import Link from "next/link";

import { ResumePaymentButton } from "@/components/subscriptions/resume-payment-button";
import { createDbClient } from "@/lib/db/client";
import { formatCents } from "@/lib/plans/money";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";
import { isTenantManager } from "@/lib/auth/permissions";

function statusLabel(status: string) {
  switch (status) {
    case "pending_payment":
      return "Esperando confirmación de transferencia";
    case "pending_authorization":
      return "Falta autorizar en Mercado Pago";
    case "active":
      return "Activa";
    case "cancelled":
      return "Cancelada";
    case "past_due":
      return "Vencida";
    case "trialing":
      return "Prueba";
    default:
      return status;
  }
}

export default async function TenantDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { tenantSlug } = await params;
  const { payment } = await searchParams;
  const { user, tenant, role } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}`,
  });

  const db = createDbClient();

  const { count: memberCount } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber")
    .is("deleted_at", null);

  const { data: subscriptions } = await db
    .from("subscriptions")
    .select(
      "id, status, plan_id, final_price_cents, created_at, payment_method, mp_init_point",
    )
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const planIds = [...new Set((subscriptions ?? []).map((sub) => sub.plan_id))];
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
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">
        {role === "subscriber" ? "Mis suscripciones" : "Panel del cliente"}
      </h1>
      <p className="mt-2 text-gray-600">
        Sesión: {user.email} · Rol: {role}
      </p>

      {payment === "return" && role === "subscriber" && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Volviste de Mercado Pago. Si autorizaste el cobro, tu suscripción se
          va a activar en unos segundos.
        </p>
      )}

      {role === "subscriber" && (
        <div className="mt-8 space-y-4">
          {(subscriptions ?? []).length === 0 ? (
            <div className="ori-card">
              <p className="text-sm text-gray-600">
                Todavía no tenés suscripciones activas.
              </p>
              <Link
                href={`/app/${tenant.slug}/mi-suscripcion/agregar`}
                className="ori-btn-primary mt-4 inline-flex"
              >
                Agregar suscripción
              </Link>
            </div>
          ) : (
            (subscriptions ?? []).map((subscription) => {
              const plan = plansById.get(subscription.plan_id);
              const needsCardPayment =
                subscription.status === "pending_authorization" &&
                (subscription.payment_method === "card_monthly" ||
                  subscription.payment_method === "card_annual");
              const isTransferPending =
                subscription.status === "pending_payment" &&
                subscription.payment_method === "transfer";

              return (
                <div key={subscription.id} className="ori-card space-y-4">
                  <Link
                    href={`/app/${tenant.slug}/mi-suscripcion/${subscription.id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Suscripción</p>
                        <p className="mt-2 text-xl font-semibold text-gray-900">
                          {plan?.name ?? "Plan"}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Estado: {statusLabel(subscription.status)}
                        </p>
                        {subscription.final_price_cents !== null && plan && (
                          <p className="mt-1 text-sm text-gray-700">
                            {formatCents(
                              subscription.final_price_cents,
                              plan.currency,
                            )}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        Actualizar opciones →
                      </span>
                    </div>
                  </Link>

                  {needsCardPayment && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm text-amber-900">
                        Todavía falta autorizar el cobro en Mercado Pago.
                      </p>
                      <div className="mt-3">
                        <ResumePaymentButton
                          tenantSlug={tenant.slug}
                          subscriptionId={subscription.id}
                        />
                      </div>
                    </div>
                  )}

                  {isTransferPending && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Transferencia pendiente: el comercio la confirma cuando
                      vea el dinero en su cuenta.
                    </p>
                  )}
                </div>
              );
            })
          )}
          <Link
            href={`/app/${tenant.slug}/mi-suscripcion/agregar`}
            className="ori-btn-primary inline-flex"
          >
            Agregar suscripción
          </Link>
        </div>
      )}

      {isTenantManager(role) && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="ori-card">
              <p className="text-sm text-gray-600">Estado del tenant</p>
              <p className="mt-2 text-xl font-semibold capitalize">
                {tenant.status}
              </p>
            </div>
            <div className="ori-card">
              <p className="text-sm text-gray-600">Suscriptos</p>
              <p className="mt-2 text-3xl font-semibold">{memberCount ?? 0}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/app/${tenant.slug}/suscriptores`}
              className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-800 hover:border-gray-400"
            >
              Gestionar registro de suscriptos →
            </Link>
            <Link
              href={`/app/${tenant.slug}/suscripciones`}
              className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-800 hover:border-gray-400"
            >
              Gestionar suscripciones →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
