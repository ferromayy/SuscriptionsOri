import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinForm } from "@/components/join/join-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

const JOIN_BENEFITS = [
  {
    title: "Café recién tostado",
    body: "Cada envío sale fresco, listo para moler y disfrutar en casa.",
  },
  {
    title: "Precio preferencial",
    body: "Condiciones pensadas para quienes eligen formar parte.",
  },
  {
    title: "A tu ritmo",
    body: "Elegís frecuencia, cantidad y cómo querés recibirlo.",
  },
  {
    title: "Siempre listo",
    body: "Una buena taza esperándote, sin tener que acordarte de pedir.",
  },
] as const;

const JOIN_STEPS = [
  {
    number: "01",
    title: "Elegí tu experiencia",
    body: "Mirás las opciones del comercio y elegís la que mejor va con vos.",
  },
  {
    number: "02",
    title: "Completá tus datos",
    body: "Contacto, entrega y pago en unos pocos pasos claros.",
  },
  {
    number: "03",
    title: "Recibí tu café",
    body: "Nosotros preparamos el envío y vos disfrutás en casa o en la oficina.",
  },
] as const;

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
    cardsEnabled: Boolean(mpConnection),
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
            Todavía no hay experiencias disponibles. Pedile al administrador
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
        <div className="mb-8 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800">
          <p>
            Estás logueado como administrador ({currentUser!.email}). Podés
            registrarte como suscriptor abajo con <strong>otro email</strong>.
          </p>
        </div>
      )}

      <section className="max-w-3xl pt-4 sm:pt-8">
        <p className="ori-section-label">
          {tenant.name} · elegí tu experiencia
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Formá parte
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
          No se trata solamente de recibir café. Se trata de tener siempre una
          buena taza esperándote. Elegí la experiencia que mejor va con vos.
        </p>
      </section>

      <section className="mt-12 sm:mt-14">
        <JoinForm
          tenantSlug={tenant.slug}
          plans={plans}
          paymentOptions={paymentOptions}
          layout="marketing"
        />
      </section>

      <section className="mt-20 border-t border-gray-200/80 pt-14 sm:mt-24 sm:pt-16">
        <p className="ori-section-label">Incluye</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
          Beneficios de formar parte
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {JOIN_BENEFITS.map((benefit) => (
            <li key={benefit.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-900">
                {benefit.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                {benefit.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 border-t border-gray-200/80 pt-14 sm:mt-20 sm:pt-16">
        <p className="ori-section-label">Cómo funciona</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
          Tres pasos
        </h2>
        <ol className="mt-10 grid gap-10 sm:grid-cols-3">
          {JOIN_STEPS.map((item) => (
            <li key={item.number}>
              <p className="text-xs font-medium tracking-[0.16em] text-gray-400">
                {item.number}
              </p>
              <p className="mt-3 text-base font-semibold text-gray-900">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-16 pb-4 text-center text-sm text-gray-500 sm:mt-20">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={`/auth/login?next=/app/${tenant.slug}/join`}
          className="font-medium text-gray-800 underline-offset-4 hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#f6f6f4]">
      <div className="ori-container py-10 sm:py-14">{children}</div>
    </div>
  );
}
