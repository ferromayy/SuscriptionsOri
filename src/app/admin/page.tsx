import Link from "next/link";
import { redirect } from "next/navigation";

import { isPlatformAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const allowed = await isPlatformAdmin(user.id, user.email);
  if (!allowed) {
    redirect("/admin/login?error=unauthorized");
  }

  const { count: tenantCount } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
        Super Admin
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Panel de plataforma</h1>
      <p className="mt-2 text-slate-400">Sesión: {user.email}</p>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-sm text-slate-400">Tenants en la base</p>
        <p className="mt-2 text-3xl font-semibold">{tenantCount ?? 0}</p>
      </div>

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-slate-400 hover:text-slate-200"
      >
        ← Volver al inicio
      </Link>
    </div>
  );
}
