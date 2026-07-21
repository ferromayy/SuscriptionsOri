import Link from "next/link";

import {
  MetricsBreakdownList,
  MetricsStatCard,
} from "@/components/subscribers/metrics-dashboard";
import { formatWeekRangeLabel } from "@/lib/subscribers/billing-cycle";
import { getSubscriberMetrics } from "@/lib/subscribers/get-subscriber-metrics";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

function formatMoney(cents: number, currency = "ARS"): string {
  return (cents / 100).toLocaleString("es-AR", {
    style: "currency",
    currency,
  });
}

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/dashboard`,
    requireManager: true,
  });

  const metrics = await getSubscriberMetrics(tenant.id);

  return (
    <div className="ori-container py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Dashboard</h1>
      <p className="ori-subtitle mt-4">
        Métricas de suscriptores, ingresos y entregas de la semana.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/app/${tenant.slug}/suscriptores`}
          className="ori-btn-secondary"
        >
          Ver suscriptores
        </Link>
        <Link href={`/app/${tenant.slug}/pagos`} className="ori-btn-secondary">
          Ver pagos
        </Link>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricsStatCard
          label="Suscriptores registrados"
          value={metrics.registeredSubscribers}
          hint={`+${metrics.newSubscribersLast30Days} en los últimos 30 días`}
        />
        <MetricsStatCard
          label="Suscripciones activas"
          value={metrics.activeSubscriptions}
          hint={`${metrics.totalSubscriptions} en total`}
        />
        <MetricsStatCard
          label="Pendientes de pago"
          value={metrics.pendingPayment}
          hint={
            metrics.pastDue > 0
              ? `${metrics.pastDue} vencidas`
              : "Transferencias u autorizaciones"
          }
        />
        <MetricsStatCard
          label="Canceladas"
          value={metrics.cancelled}
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricsStatCard
          label="Ingresos del mes"
          value={formatMoney(metrics.revenueThisMonthCents)}
          hint={`${metrics.confirmedPaymentsThisMonth} pagos confirmados`}
        />
        <MetricsStatCard
          label="Últimos 30 días"
          value={formatMoney(metrics.revenueLast30DaysCents)}
          hint="Pagos confirmados / cobrados"
        />
        <MetricsStatCard
          label="Ingreso mensual estimado"
          value={formatMoney(metrics.estimatedMonthlyRevenueCents)}
          hint="Activas normalizadas a 30 días"
        />
      </section>

      <section className="mt-8 ori-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Entregas de esta semana
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Domingo a sábado ·{" "}
              {formatWeekRangeLabel(
                metrics.weekDeliveries.weekLabelStart,
                metrics.weekDeliveries.weekLabelEnd,
              )}
            </p>
          </div>
          <p className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
            {metrics.weekDeliveries.total}{" "}
            {metrics.weekDeliveries.total === 1 ? "entrega" : "entregas"}
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Pendientes
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {metrics.weekDeliveries.pending}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Listas (interno)
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-800">
              {metrics.weekDeliveries.ready}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Enviadas
            </p>
            <p className="mt-1 text-2xl font-semibold text-green-800">
              {metrics.weekDeliveries.shipped}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href={`/app/${tenant.slug}/suscriptores`}
            className="text-sm font-medium text-gray-800 underline-offset-4 hover:underline"
          >
            Ir a la hoja de entregas →
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <MetricsBreakdownList
          title="Por estado"
          description="Todas las suscripciones (no eliminadas)."
          items={metrics.byStatus}
        />
        <MetricsBreakdownList
          title="Por plan"
          description="Distribución de suscripciones por plan."
          items={metrics.byPlan}
        />
        <MetricsBreakdownList
          title="Por método de pago"
          items={metrics.byPaymentMethod}
        />
        <MetricsBreakdownList
          title="Por ciclo de facturación"
          items={metrics.byBillingCycle}
        />
        <MetricsBreakdownList
          title="Por tipo de entrega"
          items={metrics.byDeliveryMethod}
        />
      </div>
    </div>
  );
}
