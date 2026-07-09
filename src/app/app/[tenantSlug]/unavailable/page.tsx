import Link from "next/link";
import { redirect } from "next/navigation";

import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  suspended: {
    title: "Organización suspendida",
    body: "Esta organización fue suspendida. Contactá al administrador de la plataforma si necesitás acceso.",
  },
  cancelled: {
    title: "Organización cancelada",
    body: "Esta organización ya no está activa. No podés acceder al portal.",
  },
  pending_owner: {
    title: "Organización pendiente",
    body: "Esta organización aún no está activa. El dueño debe completar la invitación.",
  },
};

export default async function TenantUnavailablePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    redirect("/");
  }

  if (tenant.status === "active") {
    redirect(`/app/${tenant.slug}`);
  }

  const copy = STATUS_MESSAGES[tenant.status] ?? {
    title: "Organización no disponible",
    body: "No podés acceder al portal en este momento.",
  };

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg ori-form-shell text-center">
        <p className="ori-eyebrow">{tenant.name}</p>
        <h1 className="ori-title mt-2 text-2xl">{copy.title}</h1>
        <p className="ori-subtitle mt-4">{copy.body}</p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
