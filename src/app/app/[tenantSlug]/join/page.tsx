import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinForm } from "@/components/join/join-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export default async function TenantJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { tenantSlug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";
  const tenant = await getTenantBySlug(tenantSlug);
  const currentUser = await getCurrentUser();

  if (!tenant) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">Organización no encontrada</h1>
          <p className="ori-subtitle mt-4">
            El link no es válido. Verificá la URL con quien te invitó.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-gray-600">
            ← Inicio
          </Link>
        </div>
      </JoinShell>
    );
  }

  if (tenant.status !== "active") {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">{tenant.name}</h1>
          <p className="ori-subtitle mt-4">
            Esta organización aún no está activa. Volvé a intentar más tarde.
          </p>
        </div>
      </JoinShell>
    );
  }

  if (!tenant.allowPublicSignup) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">{tenant.name}</h1>
          <p className="ori-subtitle mt-4">
            El registro público está deshabilitado para esta organización.
          </p>
        </div>
      </JoinShell>
    );
  }

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    if (role === "subscriber") {
      redirect(`/app/${tenant.slug}`);
    }
    if (!isTenantManager(role)) {
      const { userHasPendingSubscription } = await import(
        "@/lib/subscribers/ensure-subscriber-membership"
      );
      if (await userHasPendingSubscription(currentUser.id, tenant.id)) {
        redirect(`/app/${tenant.slug}/pendiente`);
      }
    }
  }

  const plans = await getActivePlansForTenant(tenant.id);
  const mpConnection = await getTenantMpConnection(tenant.id);
  const paymentOptions = {
    // Mercado Pago card checkout temporarily disabled — transfer only.
    cardsEnabled: false,
    transferEnabled: Boolean(
      mpConnection?.transferAlias || mpConnection?.transferCbu,
    ),
    transferAlias: mpConnection?.transferAlias ?? null,
    transferCbu: mpConnection?.transferCbu ?? null,
    transferHolderName: mpConnection?.transferHolderName ?? null,
  };

  if (plans.length === 0) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">{tenant.name}</h1>
          <p className="ori-subtitle mt-4">
            Todavía no hay suscripciones disponibles. Pedile al administrador
            que configure una en el panel.
          </p>
        </div>
      </JoinShell>
    );
  }

  let loggedInAsManager = false;

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    loggedInAsManager = isTenantManager(role);
  }

  return (
    <JoinShell>
      {isPreview && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-medium">Vista previa del formulario público</p>
          <p className="mt-1 text-blue-800">
            Así lo ven tus suscriptos cuando abren el link público.
          </p>
          <Link
            href={`/app/${tenant.slug}/suscriptores`}
            className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
          >
            ← Volver a Suscriptores
          </Link>
        </div>
      )}
      {loggedInAsManager && !isPreview && (
        <div className="mb-8 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          <p>
            Estás logueado como administrador ({currentUser!.email}). Podés
            registrarte como suscriptor abajo con <strong>otro email</strong>.
          </p>
        </div>
      )}

      <section className="mx-auto max-w-3xl py-6 text-center sm:py-10">
        <p className="ori-eyebrow">Formá parte de Orí</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl sm:leading-tight">
          El café que elijas, recién tostado, todos los meses.
        </h1>
        <div className="mx-auto mt-6 max-w-2xl space-y-2 text-lg leading-relaxed text-gray-600">
          <p>No se trata solamente de recibir café.</p>
          <p className="font-medium text-gray-900">
            Se trata de tener siempre una buena taza esperándote.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-4xl rounded-3xl border border-gray-200 bg-gray-50 px-6 py-8 sm:px-10 sm:py-10">
        <div className="text-center">
          <p className="ori-eyebrow">Una experiencia pensada para vos</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
            ¿Por qué formar parte de Orí?
          </h2>
        </div>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
          {[
            "Café recién tostado para cada envío.",
            "Precio preferencial para suscriptores.",
            "Elegís cómo y cada cuánto recibirlo.",
            "Beneficios exclusivos por formar parte.",
            "Siempre listo cuando lo necesitás.",
          ].map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-gray-700"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
                aria-hidden
              >
                ✓
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto mt-14 max-w-2xl text-center">
        <p className="ori-eyebrow">Tu café, a tu manera</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          Elegí la experiencia que mejor va con vos
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-600">
          Elegí tu café, la frecuencia y cómo querés recibirlo. Del tostado a tu
          taza, cuidamos cada detalle.
        </p>
      </div>

      <div className="mx-auto mt-8 w-full max-w-xl">
        <JoinForm
          tenantSlug={tenant.slug}
          plans={plans}
          paymentOptions={paymentOptions}
        />
        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{" "}
          <Link
            href={`/auth/login?next=/app/${tenant.slug}/join`}
            className="text-gray-700 hover:text-gray-600"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ori-container py-12 sm:py-16">
      {children}
    </div>
  );
}
