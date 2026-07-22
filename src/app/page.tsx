import Link from "next/link";

import { hasDatabaseConfig } from "@/lib/env";
import { createDbClient } from "@/lib/db/client";
import { ensureSuperAdminExists } from "@/lib/auth/bootstrap";

async function getSystemStatus() {
  if (!hasDatabaseConfig()) {
    return {
      configured: false,
      connected: false,
      tenants: 0,
      auth: "custom",
      message: "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY",
    } as const;
  }

  try {
    await ensureSuperAdminExists();
    const db = createDbClient();
    const { count, error } = await db
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    if (error) {
      return {
        configured: true,
        connected: false,
        tenants: 0,
        auth: "custom",
        message: error.message,
      } as const;
    }

    return {
      configured: true,
      connected: true,
      tenants: count ?? 0,
      auth: "custom",
      message: "PostgreSQL conectado · Auth propio (gratis)",
    } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      configured: true,
      connected: false,
      tenants: 0,
      auth: "custom",
      message,
    } as const;
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
        ok
          ? "bg-gray-100 text-gray-900"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
    </span>
  );
}

export default async function Home() {
  const status = await getSystemStatus();

  return (
    <div className="min-h-full bg-white text-gray-900">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col px-6 py-16">
        <header className="mb-12">
          <p className="ori-eyebrow">Subscriptions Ori</p>
          <h1 className="ori-title mt-2 text-4xl">
            Plataforma de suscripciones
          </h1>
          <p className="ori-subtitle mt-4 max-w-2xl text-lg">
            Supabase solo como PostgreSQL. Auth y roles 100% en la app.
          </p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
          <h2 className="text-xl font-semibold">Estado del sistema</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <StatusBadge
              ok={status.configured}
              label={status.configured ? "Env configurado" : "Env pendiente"}
            />
            <StatusBadge
              ok={status.connected}
              label={status.connected ? "DB conectada" : "DB sin conexión"}
            />
            <StatusBadge ok label={`Auth: ${status.auth}`} />
          </div>
          <p className="mt-6 text-gray-700">{status.message}</p>
          {status.connected && (
            <p className="mt-2 text-sm text-gray-500">
              Tenants registrados: {status.tenants}
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/admin/login"
            className="rounded-xl border border-gray-200 bg-gray-50 p-6 transition hover:border-gray-300"
          >
            <h3 className="font-medium">Super Admin</h3>
            <p className="mt-2 text-sm text-gray-600">Acceso de plataforma</p>
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl border border-gray-200 bg-gray-50 p-6 transition hover:border-gray-300"
          >
            <h3 className="font-medium">Acceso de organización</h3>
            <p className="mt-2 text-sm text-gray-600">
              Dueños y administradores del comercio
            </p>
          </Link>
          <Link
            href="/join"
            className="rounded-xl border border-gray-200 bg-gray-50 p-6 transition hover:border-gray-300"
          >
            <h3 className="font-medium">Soy suscriptor</h3>
            <p className="mt-2 text-sm text-gray-600">
              Encontrar el portal de mi comercio
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
}
