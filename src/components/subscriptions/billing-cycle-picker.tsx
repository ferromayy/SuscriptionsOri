"use client";

import type { BillingCycleDays } from "@/lib/subscribers/checkout-schemas";
import { billingCycleLabel } from "@/lib/plans/money";
import { formatCents } from "@/lib/plans/money";

export function BillingCyclePicker({
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
        El cobro y el envío se repiten cada 30 días desde el inicio de tu
        suscripción.
      </p>
      <label className="flex items-start gap-3 rounded-lg border border-gray-900 bg-gray-50 px-4 py-3">
        <input
          type="radio"
          name={name}
          value={30}
          checked
          readOnly
          className="mt-1"
        />
        <span>
          <span className="block font-medium text-gray-900">
            {billingCycleLabel(30)}
          </span>
          {typeof priceCents === "number" && (
            <span className="mt-1 block text-xs text-gray-500">
              {formatCents(priceCents, currency, 30)}
            </span>
          )}
        </span>
      </label>
    </fieldset>
  );
}
