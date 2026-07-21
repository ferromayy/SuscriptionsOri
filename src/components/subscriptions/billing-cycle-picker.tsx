"use client";

import type { BillingCycleDays } from "@/lib/subscribers/checkout-schemas";
import { billingCycleLabel } from "@/lib/plans/money";
import { formatCents } from "@/lib/plans/money";

const OPTIONS: BillingCycleDays[] = [15, 30, 45];

export function BillingCyclePicker({
  value,
  onChange,
  priceCents,
  currency = "ars",
  name = "billingCycleDays",
}: {
  value: BillingCycleDays;
  onChange: (days: BillingCycleDays) => void;
  priceCents?: number;
  currency?: string;
  name?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-gray-900">
        Cada cuánto querés que pasemos
      </legend>
      <p className="text-xs text-gray-500">
        El cobro y el envío se repiten cada tantos días desde el inicio de tu
        suscripción. Si lo cambiás, aplica para el próximo envío.
      </p>
      <div className="space-y-2">
        {OPTIONS.map((days) => (
          <label
            key={days}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
              value === days
                ? "border-gray-900 bg-gray-50"
                : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={days}
              checked={value === days}
              onChange={() => onChange(days)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-gray-900">
                {billingCycleLabel(days)}
              </span>
              {typeof priceCents === "number" && (
                <span className="mt-1 block text-xs text-gray-500">
                  {formatCents(priceCents, currency, days)}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
