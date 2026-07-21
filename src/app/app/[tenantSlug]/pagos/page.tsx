import Link from "next/link";

import { ConnectAccessTokenForm } from "@/components/payments/connect-access-token-form";
import { ConfirmRenewalButton } from "@/components/payments/confirm-renewal-button";
import { ConnectMercadoPagoButton } from "@/components/payments/connect-mercadopago-button";
import { DisconnectMercadoPagoButton } from "@/components/payments/disconnect-mercadopago-button";
import { PaymentHistoryList } from "@/components/payments/payment-history-list";
import {
  PaymentReminderList,
  SubscriberPaymentReminder,
  type PaymentReminderItem,
} from "@/components/payments/payment-reminder-list";
import { TransferDetailsForm } from "@/components/payments/transfer-details-form";
import { TransferPaymentGuide } from "@/components/payments/transfer-payment-guide";
import { TransferRenewalForm } from "@/components/payments/transfer-renewal-form";
import { isTenantManager } from "@/lib/auth/permissions";
import { createDbClient } from "@/lib/db/client";
import { getAppUrl } from "@/lib/env";
import { isMercadoPagoConfigured } from "@/lib/mercadopago/env";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { fetchPreapproval } from "@/lib/mercadopago/subscriptions";
import { listPaymentEvents } from "@/lib/payments/payment-events";
import {
  ensureCurrentPaymentCycle,
  getOpenPaymentCycles,
} from "@/lib/payments/payment-cycles";
import { formatCents } from "@/lib/plans/money";
import {
  daysUntilDate,
  formatCycleDate,
  getNextPaymentDueDate,
} from "@/lib/subscribers/billing-cycle";
import { buildWhatsAppUrl } from "@/lib/subscribers/whatsapp";
import { getPaymentReceiptSignedUrl } from "@/lib/storage/payment-receipts";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function TenantPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { tenantSlug } = await params;
  const { connected, error } = await searchParams;
  const { user, tenant, role } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
  });

  const manager = isTenantManager(role);
  const paymentEvents = await listPaymentEvents({
    tenantId: tenant.id,
    userId: manager ? undefined : user.id,
    limit: manager ? 200 : 50,
  });

  if (!manager) {
    const { data: transferSubs } = await createDbClient()
      .from("subscriptions")
      .select("id, created_at, billing_cycle_days, status")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .eq("payment_method", "transfer")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const hasTransferSubscription = (transferSubs ?? []).length > 0;
    for (const subscription of transferSubs ?? []) {
      await ensureCurrentPaymentCycle(subscription.id);
    }
    const openCycles = await getOpenPaymentCycles({
      tenantId: tenant.id,
      userId: user.id,
    });
    const transferCycle = openCycles.find(
      (cycle) => cycle.paymentMethod === "transfer",
    );
    const activeTransfer = (transferSubs ?? []).find(
      (subscription) => subscription.status === "active",
    );
    let subscriberReminder:
      | { dueDateLabel: string; daysUntilDue: number }
      | null = null;
    if (activeTransfer) {
      const { data: latestPaidEvent } = await createDbClient()
        .from("payment_events")
        .select("due_on, paid_at, created_at")
        .eq("subscription_id", activeTransfer.id)
        .in("kind", ["confirmed", "charged"])
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const dueDate = getNextPaymentDueDate(
        latestPaidEvent?.due_on ??
          latestPaidEvent?.paid_at ??
          latestPaidEvent?.created_at,
        activeTransfer.created_at,
        activeTransfer.billing_cycle_days,
      );
      const daysUntilDue = daysUntilDate(dueDate);
      if (daysUntilDue <= 7) {
        subscriberReminder = {
          dueDateLabel: formatCycleDate(dueDate),
          daysUntilDue,
        };
      }
    }

    return (
      <div className="ori-container py-16">
        <p className="ori-eyebrow">{tenant.name}</p>
        <h1 className="ori-title mt-2">Pagos</h1>
        <p className="ori-subtitle mt-4">
          Historial de tus pagos, con fecha y día de cobro de cada ciclo.
        </p>

        {subscriberReminder && (
          <section className="mt-8">
            <SubscriberPaymentReminder
              tenantSlug={tenant.slug}
              dueDateLabel={subscriberReminder.dueDateLabel}
              daysUntilDue={subscriberReminder.daysUntilDue}
            />
          </section>
        )}

        {hasTransferSubscription && !subscriberReminder && (
          <section className="mt-8">
            <TransferPaymentGuide tenantSlug={tenant.slug} />
          </section>
        )}

        {transferCycle &&
          transferCycle.status !== "upcoming" &&
          transferCycle.status !== "submitted" && (
            <section className="mt-8 ori-card space-y-4">
              <div>
                <p className="ori-section-label">Transferencia</p>
                <h2 className="mt-2 text-lg font-medium text-gray-900">
                  Enviar comprobante del ciclo
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Vencimiento:{" "}
                  {formatCycleDate(
                    new Date(`${transferCycle.dueOn}T12:00:00`),
                  )}
                </p>
              </div>
              <TransferRenewalForm
                tenantSlug={tenant.slug}
                cycleId={transferCycle.id}
              />
            </section>
          )}

        {transferCycle?.status === "submitted" && (
          <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Recibimos el comprobante de este ciclo. Está esperando confirmación
            del comercio.
          </p>
        )}

        <section className="mt-8 ori-card space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            Registro de pagos
          </h2>
          <PaymentHistoryList
            events={paymentEvents}
            tenantSlug={tenant.slug}
            emptyMessage="Todavía no registramos pagos para tu suscripción."
          />
        </section>

        <Link href={`/app/${tenant.slug}`} className="mt-8 inline-block text-sm text-gray-600 hover:text-gray-900">
          ← Volver al panel
        </Link>
      </div>
    );
  }

  const configured = isMercadoPagoConfigured();
  const connection = await getTenantMpConnection(tenant.id);
  const useTestToken = process.env.MP_USE_TEST_TOKEN === "true";

  const db = createDbClient();
  const { data: transferSubscriptions } = await db
    .from("subscriptions")
    .select(
      "id, user_id, plan_id, contact_first_name, contact_last_name, contact_phone, final_price_cents, billing_cycle_days, created_at",
    )
    .eq("tenant_id", tenant.id)
    .eq("payment_method", "transfer")
    .in("status", ["active", "past_due", "pending_payment"])
    .is("deleted_at", null);

  for (const subscription of transferSubscriptions ?? []) {
    await ensureCurrentPaymentCycle(subscription.id);
  }
  const managerOpenCycles = await getOpenPaymentCycles({
    tenantId: tenant.id,
  });

  const transferPlanIds = [
    ...new Set((transferSubscriptions ?? []).map((sub) => sub.plan_id)),
  ];
  const { data: transferPlans } = transferPlanIds.length
    ? await db
        .from("plans")
        .select("id, name, currency")
        .in("id", transferPlanIds)
        .is("deleted_at", null)
    : { data: [] };
  const transferPlansById = new Map(
    (transferPlans ?? []).map((plan) => [plan.id, plan]),
  );
  const paymentReminders: PaymentReminderItem[] = (
    transferSubscriptions ?? []
  )
    .map((subscription) => {
      const openCycle = managerOpenCycles.find(
        (cycle) => cycle.subscriptionId === subscription.id,
      );
      if (
        !openCycle ||
        openCycle.status === "submitted" ||
        openCycle.reminderWhatsAppOpenedAt
      ) {
        return null;
      }
      const dueDate = new Date(`${openCycle.dueOn}T12:00:00`);
      const daysUntilDue = daysUntilDate(dueDate);
      const plan = transferPlansById.get(subscription.plan_id);
      const subscriberName =
        [
          subscription.contact_first_name,
          subscription.contact_last_name,
        ]
          .filter(Boolean)
          .join(" ") || "Suscriptor";
      const amountLabel = formatCents(
        subscription.final_price_cents ?? 0,
        plan?.currency ?? "ars",
        30,
      );
      const dueDateLabel = formatCycleDate(dueDate);
      const accountUrl = `${getAppUrl()}/app/${tenant.slug}/pagos`;
      const transferDestination = [
        connection?.transferHolderName
          ? `Titular: ${connection.transferHolderName}.`
          : "",
        connection?.transferAlias ? `Alias: ${connection.transferAlias}.` : "",
        connection?.transferCbu ? `CBU/CVU: ${connection.transferCbu}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const message =
        `Hola ${subscriberName} 👋 Te recordamos que el pago de tu suscripción ` +
        `${plan?.name ?? "de café"} por ${amountLabel} vence el ${dueDateLabel}. ` +
        `${transferDestination} Después podés enviar el comprobante por acá ` +
        `o gestionarlo desde ${accountUrl}. El pedido se prepara una vez confirmado el pago.`;

      return {
        cycleId: openCycle.id,
        subscriptionId: subscription.id,
        subscriberName,
        planName: plan?.name ?? "Suscripción",
        amountLabel,
        dueDateLabel,
        daysUntilDue,
        whatsappUrl: buildWhatsAppUrl(subscription.contact_phone, message),
      };
    })
    .filter(
      (reminder): reminder is PaymentReminderItem =>
        reminder !== null && reminder.daysUntilDue <= 7,
    );

  const submittedCycles = managerOpenCycles.filter(
    (cycle) =>
      cycle.paymentMethod === "transfer" && cycle.status === "submitted",
  );
  const submittedReceiptUrls = new Map<string, string>();
  for (const cycle of submittedCycles) {
    if (!cycle.paymentReceiptPath) continue;
    const signedUrl = await getPaymentReceiptSignedUrl(
      cycle.paymentReceiptPath,
    );
    if (signedUrl) submittedReceiptUrls.set(cycle.id, signedUrl);
  }

  const { data: recentCardSubs } = await db
    .from("subscriptions")
    .select(
      "id, status, payment_status, payment_method, contact_email, mp_preapproval_id, mp_init_point, mp_last_rejection_detail, mp_last_rejection_at, final_price_cents, billing_interval, created_at",
    )
    .eq("tenant_id", tenant.id)
    .in("payment_method", ["card_monthly", "card_annual"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const diagnostics = [];
  for (const sub of recentCardSubs ?? []) {
    const remote = sub.mp_preapproval_id
      ? await fetchPreapproval(tenant.id, sub.mp_preapproval_id)
      : null;
    diagnostics.push({ sub, remote });
  }

  return (
    <div className="ori-container py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Pagos</h1>
      <p className="ori-subtitle mt-4">
        Registro de cobros y configuración de Mercado Pago o transferencia.
      </p>

      {connected === "1" && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Mercado Pago conectado correctamente.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error === "not_configured"
            ? "Falta configurar las credenciales de la plataforma (MP_CLIENT_ID / MP_CLIENT_SECRET)."
            : error === "denied"
              ? "No se autorizó la conexión. Podés intentar de nuevo."
              : "No se pudo completar la conexión. Intentá otra vez."}
        </p>
      )}

      <section className="mt-8 ori-card space-y-4">
        <h2 className="text-lg font-medium text-gray-900">
          Registro de pagos
        </h2>
        <p className="text-sm text-gray-600">
          Todos los pagos confirmados, con fecha de pago y día de cobro del
          ciclo.
        </p>
        <PaymentHistoryList
          events={paymentEvents}
          tenantSlug={tenant.slug}
          showSubscriber
        />
      </section>

      <PaymentReminderList
        tenantSlug={tenant.slug}
        reminders={paymentReminders}
      />

      <section className="mt-8 ori-card space-y-4">
        <div>
          <p className="ori-section-label">Revisión humana</p>
          <h2 className="mt-2 text-lg font-medium text-gray-900">
            Comprobantes recurrentes por confirmar
          </h2>
        </div>
        {submittedCycles.length === 0 ? (
          <p className="text-sm text-gray-600">
            No hay comprobantes recurrentes esperando confirmación.
          </p>
        ) : (
          <ul className="space-y-3">
            {submittedCycles.map((cycle) => {
              const subscription = (transferSubscriptions ?? []).find(
                (item) => item.id === cycle.subscriptionId,
              );
              const plan = subscription
                ? transferPlansById.get(subscription.plan_id)
                : null;
              const name =
                [
                  subscription?.contact_first_name,
                  subscription?.contact_last_name,
                ]
                  .filter(Boolean)
                  .join(" ") || "Suscriptor";
              const receiptUrl = submittedReceiptUrls.get(cycle.id);
              return (
                <li
                  key={cycle.id}
                  className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{name}</p>
                    <p className="mt-1 text-gray-600">
                      {plan?.name ?? "Suscripción"} · Ciclo{" "}
                      {cycle.cycleNumber} ·{" "}
                      {formatCents(
                        cycle.amountCents,
                        plan?.currency ?? "ars",
                        30,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Vencimiento:{" "}
                      {formatCycleDate(
                        new Date(`${cycle.dueOn}T12:00:00`),
                      )}
                    </p>
                    {cycle.paymentReference && (
                      <p className="mt-1 text-gray-600">
                        Operación: {cycle.paymentReference}
                      </p>
                    )}
                    {receiptUrl && (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block font-medium text-gray-900 underline"
                      >
                        Ver comprobante
                      </a>
                    )}
                  </div>
                  <ConfirmRenewalButton
                    tenantSlug={tenant.slug}
                    cycleId={cycle.id}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 ori-card space-y-4">
        <h2 className="text-lg font-medium text-gray-900">
          Cómo conectar (3 pasos)
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Tené una cuenta de{" "}
            <a
              href="https://www.mercadopago.com.ar"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Mercado Pago
            </a>{" "}
            (la de tu negocio).
          </li>
          <li>Hacé clic en «Conectar Mercado Pago».</li>
          <li>Iniciá sesión en Mercado Pago y autorizá a Ori.</li>
        </ol>
      </section>

      <section className="mt-8 ori-card space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Estado</h2>
        {!configured ? (
          <p className="text-sm text-gray-600">
            La plataforma todavía no tiene Mercado Pago configurado. Pedile al
            administrador de Ori que cargue las credenciales.
          </p>
        ) : connection ? (
          <>
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">Conectado</span>
              {connection.mpUserId ? ` · ID ${connection.mpUserId}` : ""}
              {connection.liveMode ? " · Producción" : " · Test"}
            </p>
            <p className="text-xs text-gray-500">
              Desde: {new Date(connection.connectedAt).toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-gray-500">
              Plataforma: MP_USE_TEST_TOKEN={useTestToken ? "true" : "false"}
            </p>
            {useTestToken && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Para suscripciones, Mercado Pago recomienda{" "}
                <span className="font-medium">MP_USE_TEST_TOKEN=false</span> y
                conectar Pagos con el{" "}
                <span className="font-medium">vendedor de prueba</span>. Con
                test_token el botón Confirmar del checkout suele quedar
                bloqueado.
              </p>
            )}
            {!useTestToken && connection && !connection.liveMode && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
                Configuración correcta para pruebas de suscripciones: vendedor de
                prueba con token de producción de esa cuenta.
              </p>
            )}
            <DisconnectMercadoPagoButton tenantSlug={tenant.slug} />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Todavía no hay una cuenta conectada. Sin esto, tus suscriptos no
              pueden pagar con tarjeta.
            </p>
            <ConnectMercadoPagoButton tenantSlug={tenant.slug} />
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900">
                ¿La cuenta de Mercado Pago es la misma dueña de la aplicación?
              </h3>
              <p className="mt-1 mb-3 text-sm text-gray-600">
                Mercado Pago no permite autorizar tu propia aplicación por
                OAuth («la aplicación no puede conectarse a tu cuenta»). En ese
                caso, conectá pegando el Access Token de producción.
              </p>
              <ConnectAccessTokenForm tenantSlug={tenant.slug} />
            </div>
          </>
        )}
      </section>

      {connection && (
        <section className="mt-8 ori-card space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            Datos para transferencia
          </h2>
          <p className="text-sm text-gray-600">
            Si ofrecés pago por transferencia, cargá CBU/alias para mostrarlos
            al suscriptor. La confirmación del pago la vas a ver como pendiente
            hasta que lo marques.
          </p>
          <TransferDetailsForm
            tenantSlug={tenant.slug}
            initial={{
              transferCbu: connection.transferCbu ?? "",
              transferAlias: connection.transferAlias ?? "",
              transferHolderName: connection.transferHolderName ?? "",
            }}
          />
        </section>
      )}

      {connection && (
        <section className="mt-8 ori-card space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            Diagnóstico tarjeta (últimas 5)
          </h2>
          <p className="text-sm text-gray-600">
            Estado en Ori vs lo que responde Mercado Pago para el preapproval.
          </p>
          {diagnostics.length === 0 ? (
            <p className="text-sm text-gray-600">
              Todavía no hay suscripciones con tarjeta.
            </p>
          ) : (
            <ul className="space-y-4 text-xs text-gray-700">
              {diagnostics.map(({ sub, remote }) => (
                <li
                  key={sub.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono"
                >
                  <p>ori_id: {sub.id}</p>
                  <p>
                    ori_status: {sub.status} / payment_status:{" "}
                    {sub.payment_status ?? "null"}
                  </p>
                  <p>method: {sub.payment_method}</p>
                  <p>contact_email: {sub.contact_email ?? "null"}</p>
                  <p>mp_preapproval_id: {sub.mp_preapproval_id ?? "null"}</p>
                  <p>
                    mp_last_rejection_detail:{" "}
                    {sub.mp_last_rejection_detail ?? "null"}
                  </p>
                  <p>
                    mp_last_rejection_at: {sub.mp_last_rejection_at ?? "null"}
                  </p>
                  <p className="break-all">
                    mp_init_point: {sub.mp_init_point ?? "null"}
                  </p>
                  {remote ? (
                    <>
                      <p className="mt-2 text-gray-900">— remoto MP —</p>
                      <p>status: {remote.status}</p>
                      <p>payer_email: {remote.payer_email ?? "null"}</p>
                      <p>live_mode: {String(remote.live_mode ?? "null")}</p>
                      <p>collector_id: {remote.collector_id ?? "null"}</p>
                      <p>
                        amount:{" "}
                        {remote.auto_recurring?.transaction_amount ?? "null"}{" "}
                        {remote.auto_recurring?.currency_id ?? ""} / freq{" "}
                        {remote.auto_recurring?.frequency ?? "?"}{" "}
                        {remote.auto_recurring?.frequency_type ?? ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-amber-800">
                      No se pudo leer el preapproval en MP (id vacío o token
                      inválido).
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Link
        href={`/app/${tenant.slug}`}
        className="mt-8 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver al panel
      </Link>
    </div>
  );
}
