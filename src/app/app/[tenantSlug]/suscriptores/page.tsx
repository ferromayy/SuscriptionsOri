import Link from "next/link";

import { ConfirmTransferButton } from "@/components/subscribers/confirm-transfer-button";
import {
  WeeklyDeliverySheet,
  buildWeeklyDeliveryRows,
} from "@/components/subscribers/weekly-delivery-sheet";
import { CopyLinkButton } from "@/components/tenant/copy-link-button";
import { createDbClient } from "@/lib/db/client";
import { formatCents } from "@/lib/plans/money";
import { formatPlanPrice } from "@/lib/plans/format-price";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getPaymentReceiptSignedUrl } from "@/lib/storage/payment-receipts";
import {
  getSundaySaturdayWeek,
  toDateKey,
} from "@/lib/subscribers/billing-cycle";
import { subscriptionStatusLabel } from "@/lib/subscribers/status-labels";
import { getTenantJoinUrl } from "@/lib/tenants/join-url";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";
import type {
  DeliveryFulfillmentStatus,
  PaymentCycleStatus,
  SubscriptionStatus,
} from "@/types/database";

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

  const { data: members } = await db
    .from("tenant_members")
    .select("id, user_id, status, joined_via, created_at")
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const usersById = new Map<
    string,
    { email: string; fullName: string | null; emailVerifiedAt: string | null }
  >();

  if (userIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, email, full_name, email_verified_at")
      .in("id", userIds)
      .is("deleted_at", null);
    for (const user of users ?? []) {
      usersById.set(user.id, {
        email: user.email,
        fullName: user.full_name,
        emailVerifiedAt: user.email_verified_at,
      });
    }
  }

  const { data: allSubscriptions } = userIds.length
    ? await db
        .from("subscriptions")
        .select(
          "id, user_id, plan_id, status, final_price_cents, contact_email, contact_first_name, contact_last_name, contact_phone, created_at, billing_cycle_days, delivery_method, delivery_details",
        )
        .eq("tenant_id", tenant.id)
        .in("user_id", userIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  // Pending transfers must be fetched directly by tenant: the subscriber only
  // becomes a tenant member after the payment is confirmed, so filtering by
  // membership would hide every new pending transfer.
  const { data: pendingWithReceipt } = await db
    .from("subscriptions")
    .select(
      "id, payment_reference, payment_receipt_path, contact_email, contact_first_name, contact_last_name, final_price_cents, plan_id, user_id, created_at",
    )
    .eq("tenant_id", tenant.id)
    .eq("status", "pending_payment")
    .eq("payment_method", "transfer")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const planIds = [
    ...new Set([
      ...(allSubscriptions ?? []).map((sub) => sub.plan_id),
      ...(pendingWithReceipt ?? []).map((sub) => sub.plan_id),
    ]),
  ];
  const plansById = new Map<string, { name: string; currency: string }>();
  if (planIds.length > 0) {
    const { data: planRows } = await db
      .from("plans")
      .select("id, name, currency")
      .in("id", planIds)
      .is("deleted_at", null);
    for (const plan of planRows ?? []) {
      plansById.set(plan.id, { name: plan.name, currency: plan.currency });
    }
  }

  const subscriptionsByUser = new Map<string, typeof allSubscriptions>();
  for (const sub of allSubscriptions ?? []) {
    const list = subscriptionsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subscriptionsByUser.set(sub.user_id, list);
  }

  const plans = await getActivePlansForTenant(tenant.id);

  const receiptUrls = new Map<string, string>();
  for (const sub of pendingWithReceipt ?? []) {
    if (!sub.payment_receipt_path) continue;
    const url = await getPaymentReceiptSignedUrl(sub.payment_receipt_path);
    if (url) receiptUrls.set(sub.id, url);
  }

  const subscriptionIds = (allSubscriptions ?? []).map((sub) => sub.id);
  const choicesBySubscription = new Map<
    string,
    Array<{ fieldLabel: string; value: string }>
  >();

  if (subscriptionIds.length > 0) {
    const { data: choices } = await db
      .from("subscription_choices")
      .select("subscription_id, field_id, option_id, text_value")
      .in("subscription_id", subscriptionIds)
      .is("deleted_at", null);

    const fieldIds = [...new Set((choices ?? []).map((c) => c.field_id))];
    const optionIds = [
      ...new Set(
        (choices ?? [])
          .map((c) => c.option_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const fieldsById = new Map<string, string>();
    if (fieldIds.length > 0) {
      const { data: fields } = await db
        .from("plan_fields")
        .select("id, label")
        .in("id", fieldIds)
        .is("deleted_at", null);
      for (const field of fields ?? []) {
        fieldsById.set(field.id, field.label);
      }
    }

    const optionsById = new Map<string, string>();
    if (optionIds.length > 0) {
      const { data: options } = await db
        .from("plan_field_options")
        .select("id, label")
        .in("id", optionIds)
        .is("deleted_at", null);
      for (const option of options ?? []) {
        optionsById.set(option.id, option.label);
      }
    }

    for (const choice of choices ?? []) {
      const list = choicesBySubscription.get(choice.subscription_id) ?? [];
      const value =
        (choice.option_id
          ? optionsById.get(choice.option_id)
          : choice.text_value) ?? "—";
      list.push({
        fieldLabel: fieldsById.get(choice.field_id) ?? "Campo",
        value,
      });
      choicesBySubscription.set(choice.subscription_id, list);
    }
  }

  const { start: weekStart, end: weekEnd } = getSundaySaturdayWeek();
  const fulfillmentByKey = new Map<string, DeliveryFulfillmentStatus>();
  const paymentStatusByKey = new Map<string, PaymentCycleStatus>();
  {
    const { data: fulfillments, error: fulfillmentError } = await db
      .from("delivery_fulfillments")
      .select("subscription_id, due_on, status")
      .eq("tenant_id", tenant.id)
      .gte("due_on", toDateKey(weekStart))
      .lte("due_on", toDateKey(weekEnd));

    // Table may not exist until migration 20250717160000 is applied.
    if (!fulfillmentError) {
      for (const row of fulfillments ?? []) {
        fulfillmentByKey.set(
          `${row.subscription_id}:${row.due_on}`,
          row.status as DeliveryFulfillmentStatus,
        );
      }
    }
  }

  if (subscriptionIds.length > 0) {
    const { data: paymentCycles } = await db
      .from("payment_cycles")
      .select("subscription_id, due_on, status")
      .in("subscription_id", subscriptionIds)
      .gte("due_on", toDateKey(weekStart))
      .lte("due_on", toDateKey(weekEnd));
    for (const cycle of paymentCycles ?? []) {
      paymentStatusByKey.set(
        `${cycle.subscription_id}:${cycle.due_on}`,
        cycle.status,
      );
    }
  }

  const weeklyDeliveries = buildWeeklyDeliveryRows({
    subscriptions: (allSubscriptions ?? []).map((sub) => ({
      ...sub,
      delivery_details:
        (sub.delivery_details as Record<string, string> | null) ?? null,
    })),
    plansById,
    usersById,
    choicesBySubscription,
    fulfillmentByKey,
    paymentStatusByKey,
  });

  return (
    <div className="ori-container py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Suscriptores</h1>
      <p className="ori-subtitle mt-4">
        Compartí el link público, o usá <span className="font-medium">Suscribir</span>{" "}
        para cargar a alguien con los mismos pasos (la transferencia se confirma
        al instante).
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/app/${tenant.slug}/suscriptores/suscribir`}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Suscribir
        </Link>
        <Link
          href={`/app/${tenant.slug}/suscripciones`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800"
        >
          Gestionar planes
        </Link>
      </div>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">Link público</h2>
        <p className="mt-2 text-sm text-gray-600">
          Quienes se registren solos usan esta URL.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-900">
            {joinUrl}
          </p>
          <CopyLinkButton url={joinUrl} />
        </div>
        <div className="mt-4">
          <Link
            href={joinPath}
            className="text-sm text-gray-700 underline-offset-4 hover:underline"
          >
            Ver formulario público
          </Link>
        </div>
        {!tenant.allowPublicSignup && (
          <p className="mt-4 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            El registro público está deshabilitado. Podés seguir dando altas
            asistidas desde este panel.
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Suscriptores registrados</p>
          <p className="mt-2 text-3xl font-semibold">{members?.length ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">
            Con al menos un pago confirmado
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Planes disponibles</p>
          <p className="mt-2 text-3xl font-semibold">{plans.length}</p>
        </div>
      </section>

      <WeeklyDeliverySheet
        tenantSlug={tenant.slug}
        weekStart={weeklyDeliveries.weekStart}
        weekEnd={weeklyDeliveries.weekEnd}
        rows={weeklyDeliveries.rows}
      />

      <section className="mt-8 ori-card space-y-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Transferencias pendientes
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Estas personas todavía no están suscriptores registrados: al confirmar
            el pago, la suscripción se activa y recién ahí quedan dados de alta.
          </p>
        </div>
        {(pendingWithReceipt ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">
            No hay transferencias pendientes.
          </p>
        ) : (
          <ul className="space-y-4">
            {(pendingWithReceipt ?? []).map((subscription) => {
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
              const receiptUrl = receiptUrls.get(subscription.id) ?? null;

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
                        Operación: {subscription.payment_reference}
                      </p>
                    )}
                    {receiptUrl && (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 underline"
                      >
                        Ver comprobante
                      </a>
                    )}
                    {usersById.has(subscription.user_id) &&
                      (members ?? []).some(
                        (m) => m.user_id === subscription.user_id,
                      ) && (
                      <p>
                        <Link
                          href={`/app/${tenant.slug}/suscriptores/${subscription.user_id}`}
                          className="text-sm text-gray-700 underline"
                        >
                          Ver ficha
                        </Link>
                      </p>
                    )}
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

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">
          Todos los suscriptores
        </h2>
        {(members ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">
            Todavía no hay suscriptores. Compartí el link o dale de alta vos.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {(members ?? []).map((member) => {
              const user = usersById.get(member.user_id);
              const subs = subscriptionsByUser.get(member.user_id) ?? [];
              const latest = subs[0];
              const contactName = latest
                ? [latest.contact_first_name, latest.contact_last_name]
                    .filter(Boolean)
                    .join(" ")
                : "";
              const displayName =
                contactName || user?.fullName || "Sin nombre";
              const email =
                latest?.contact_email || user?.email || "Sin email";
              const phone = latest?.contact_phone;

              return (
                <li key={member.id} className="py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Link
                        href={`/app/${tenant.slug}/suscriptores/${member.user_id}`}
                        className="font-medium text-gray-900 underline-offset-4 hover:underline"
                      >
                        {displayName}
                      </Link>
                      <p className="text-sm text-gray-600">{email}</p>
                      {phone && (
                        <p className="text-sm text-gray-600">{phone}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {subs.length} suscripción
                        {subs.length === 1 ? "" : "es"}
                        {latest
                          ? ` · última: ${subscriptionStatusLabel(latest.status as SubscriptionStatus)}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={`/app/${tenant.slug}/suscriptores/${member.user_id}`}
                      className="text-sm font-medium text-gray-800 underline-offset-4 hover:underline"
                    >
                      Ver todo →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {plans.length > 0 && (
        <section className="mt-8 ori-card">
          <h2 className="text-lg font-medium text-gray-900">
            Planes en el formulario
          </h2>
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
