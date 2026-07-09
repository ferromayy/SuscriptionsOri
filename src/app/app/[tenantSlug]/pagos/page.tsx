import Link from "next/link";

import { ConnectMercadoPagoButton } from "@/components/payments/connect-mercadopago-button";
import { DisconnectMercadoPagoButton } from "@/components/payments/disconnect-mercadopago-button";
import { TransferDetailsForm } from "@/components/payments/transfer-details-form";
import { isMercadoPagoConfigured } from "@/lib/mercadopago/env";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
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
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });

  const configured = isMercadoPagoConfigured();
  const connection = await getTenantMpConnection(tenant.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Pagos</h1>
      <p className="ori-subtitle mt-4">
        Conectá tu cuenta de Mercado Pago para cobrar suscripciones mensuales y
        anuales con tarjeta. No necesitás saber de código.
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
            <DisconnectMercadoPagoButton tenantSlug={tenant.slug} />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Todavía no hay una cuenta conectada. Sin esto, tus suscriptos no
              pueden pagar con tarjeta.
            </p>
            <ConnectMercadoPagoButton tenantSlug={tenant.slug} />
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
            hasta que lo marques (próximo paso).
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

      <Link
        href={`/app/${tenant.slug}`}
        className="mt-8 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver al panel
      </Link>
    </div>
  );
}
