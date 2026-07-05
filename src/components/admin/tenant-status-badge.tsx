const labels: Record<string, string> = {
  pending_owner: "Invitación pendiente",
  active: "Activo",
  suspended: "Suspendido",
  cancelled: "Cancelado",
};

const styles: Record<string, string> = {
  pending_owner: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  suspended: "bg-red-100 text-red-900",
  cancelled: "bg-slate-200 text-slate-700",
};

export function TenantStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-slate-200 text-slate-700"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
