import Link from "next/link";

import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

async function getSystemStatus() {
  if (!hasSupabaseConfig()) {
    return {
      configured: false,
      connected: false,
      tenants: 0,
      message: "Configura las variables de entorno de Supabase",
    } as const;
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true });

    if (error) {
      return {
        configured: true,
        connected: false,
        tenants: 0,
        message: error.message,
      } as const;
    }

    return {
      configured: true,
      connected: true,
      tenants: count ?? 0,
      message: "Conexión exitosa con PostgreSQL vía Supabase",
    } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      configured: true,
      connected: false,
      tenants: 0,
      message,
    } as const;
  }
}

function StatusBadge({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
        ok
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {label}
    </span>
  );
}

export default async function Home() {
  const status = await getSystemStatus();

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col px-6 py-16">
        <header className="mb-12">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
            Subscriptions Ori
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Plataforma de suscripciones
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            Base conectada: Next.js, Supabase, PostgreSQL y despliegue en Vercel.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
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
          </div>
          <p className="mt-6 text-slate-300">{status.message}</p>
          {status.connected && (
            <p className="mt-2 text-sm text-slate-500">
              Tenants registrados: {status.tenants}
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/admin/login"
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-slate-600"
          >
            <h3 className="font-medium">Super Admin</h3>
            <p className="mt-2 text-sm text-slate-400">Acceso de plataforma</p>
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-slate-600"
          >
            <h3 className="font-medium">Iniciar sesión</h3>
            <p className="mt-2 text-sm text-slate-400">Clientes y suscriptos</p>
          </Link>
          <a
            href="/api/health"
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-slate-600"
          >
            <h3 className="font-medium">Health API</h3>
            <p className="mt-2 text-sm text-slate-400">JSON de conexión</p>
          </a>
        </section>
      </div>
    </div>
  );
}
