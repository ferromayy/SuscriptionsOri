import Link from "next/link";

import { ConfirmTransferButton } from "@/components/subscribers/confirm-transfer-button";
import { CopyLinkButton } from "@/components/tenant/copy-link-button";
import { createDbClient } from "@/lib/db/client";
import { formatCents } from "@/lib/plans/money";
import { formatPlanPrice } from "@/lib/plans/format-price";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getTenantJoinUrl } from "@/lib/tenants/join-url";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function TenantSubscribersPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();
  const joinUrl = getTenantJoinUrl(tenant.slug);
  const joinPath = `/app/${tenant.slug}/join?preview=1`;

  const { count: subscriberCount } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber")
    .is("deleted_at", null);

  const plans = await getActivePlansForTenant(tenant.id);

  const { data: pendingTransfers } = await db
    .from("subscriptions")
    .select(
      "id, final_price_cents, payment_reference, contact_email, contact_first_name, contact_last_name, created_at, plan_id, user_id",
    )
    .eq("tenant_id", tenant.id)
    .eq("payment_method", "transfer")
    .eq("status", "pending_payment")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const pendingPlanIds = [
    ...new Set((pendingTransfers ?? []).map((sub) => sub.plan_id)),
  ];
  const pendingUserIds = [
    ...new Set((pendingTransfers ?? []).map((sub) => sub.user_id)),
  ];

  const plansById = new Map<string, { name: string; currency: string }>();
  if (pendingPlanIds.length > 0) {
    const { data: pendingPlans } = await db
      .from("plans")
      .select("id, name, currency")
      .in("id", pendingPlanIds)
      .is("deleted_at", null);
    for (const plan of pendingPlans ?? []) {
      plansById.set(plan.id, { name: plan.name, currency: plan.currency });
    }
  }

  const usersById = new Map<string, { email: string; fullName: string | null }>();
  if (pendingUserIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, email, full_name")
      .in("id", pendingUserIds)
      .is("deleted_at", null);
    for (const user of users ?? []) {
      usersById.set(user.id, { email: user.email, fullName: user.full_name });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Registro de suscriptos</h1>
      <p className="ori-subtitle mt-4">
        Compartí este link con quienes quieran suscribirse. Al registrarse,
        quedarán asociados a tu organización.
      </p>

      <div className="mt-6">
        <Link
          href={`/app/${tenant.slug}/suscripciones`}
          className="text-sm text-gray-700 underline-offset-4 hover:underline"
        >
          Gestionar tipos de suscripción →
        </Link>
      </div>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">Link público</h2>
        <p className="mt-2 text-sm text-gray-600">
          Los suscriptos usan esta URL para crear su cuenta y elegir un plan.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-900">
            {joinUrl}
          </p>
          <CopyLinkButton url={joinUrl} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={joinPath}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ver formulario público
          </Link>
        </div>

        {!tenant.allowPublicSignup && (
          <p className="mt-4 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            El registro público está deshabilitado. Los suscriptos no podrán
            completar el formulario hasta que lo actives.
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Suscriptos activos</p>
          <p className="mt-2 text-3xl font-semibold">{subscriberCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Planes disponibles</p>
          <p className="mt-2 text-3xl font-semibold">{plans.length}</p>
        </div>
      </section>

      <section className="mt-8 ori-card space-y-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Transferencias pendientes
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Cuando veas el dinero en tu cuenta, confirmá el pago para activar la
            suscripción.
          </p>
        </div>

        {(pendingTransfers ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">
            No hay transferencias pendientes de confirmación.
          </p>
        ) : (
          <ul className="space-y-4">
            {(pendingTransfers ?? []).map((subscription) => {
              const plan = plansById.get(subscription.plan_id);
              const user = usersById.get(subscription.user_id);
              const displayName =
                [subscription.contact_first_name, subscription.contact_last_name]
                  .filter(Boolean)
                  .join(" ") ||
                user?.fullName ||
                "Sin nombre";
              const email =
                subscription.contact_email || user?.email || "Sin email";

              return (
                <li
                  key={subscription.id}
                  className="flex flex-col gap-4 rounded-lg border border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-gray-900">{displayName}</p>
                    <p className="text-gray-600">{email}</p>
                    <p className="text-gray-600">
                      {plan?.name ?? "Suscripción"} ·{" "}
                      {formatCents(
                        subscription.final_price_cents ?? 0,
                        plan?.currency ?? "ars",
                        "month",
                      )}
                    </p>
                    {subscription.payment_reference && (
                      <p className="text-gray-600">
                        Referencia: {subscription.payment_reference}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(subscription.created_at).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <ConfirmTransferButton
                    tenantSlug={tenant.slug}
                    subscriptionId={subscription.id}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {plans.length > 0 && (
        <section className="mt-8 ori-card">
          <h2 className="text-lg font-medium text-gray-900">
            Suscripciones en el formulario
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Estas son las suscripciones activas que verán al registrarse.
          </p>
          <ul className="mt-4 space-y-3">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <span className="font-medium text-gray-900">{plan.name}</span>
                <span className="text-sm text-gray-600">
                  {formatPlanPrice(plan)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
