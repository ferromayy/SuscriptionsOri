export function MetricsStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="ori-card">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function MetricsBreakdownList({
  title,
  description,
  items,
  emptyLabel = "Sin datos todavía.",
}: {
  title: string;
  description?: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="ori-card space-y-4">
      <div>
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-600">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const width = Math.max(6, Math.round((item.count / max) * 100));
            return (
              <li key={item.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-gray-900">{item.label}</span>
                  <span className="tabular-nums text-gray-600">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-gray-900"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
