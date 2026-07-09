"use client";

import { useActionState, useMemo, useState } from "react";

import {
  createSubscriptionAction,
  updateSubscriptionAction,
  type SubscriptionActionState,
} from "@/app/app/[tenantSlug]/suscripciones/actions";
import { centsToPesos } from "@/lib/plans/money";
import type { PublicPlan } from "@/lib/plans/get-plans";
import type { CreatePlanInput } from "@/lib/plans/schemas";

type FieldDraft = {
  label: string;
  fieldType: "select" | "text";
  affectsPrice: boolean;
  options: Array<{
    label: string;
    priceDeltaPesos: string;
  }>;
};

const initialState: SubscriptionActionState = { error: null };

function emptyField(): FieldDraft {
  return {
    label: "",
    fieldType: "select",
    affectsPrice: false,
    options: [{ label: "", priceDeltaPesos: "" }],
  };
}

function buildFields(count: number, current: FieldDraft[]): FieldDraft[] {
  const next = [...current];
  while (next.length < count) {
    next.push(emptyField());
  }
  return next.slice(0, count);
}

function planToFormState(plan: PublicPlan) {
  const fieldCount = Math.max(plan.fieldCount, plan.fields.length, 1);
  const fields: FieldDraft[] =
    plan.fields.length > 0
      ? plan.fields.map((field) => ({
          label: field.label,
          fieldType: field.fieldType,
          affectsPrice: field.affectsPrice,
          options:
            field.fieldType === "select" && field.options.length > 0
              ? field.options.map((option) => ({
                  label: option.label,
                  priceDeltaPesos: field.affectsPrice
                    ? String(centsToPesos(option.priceDeltaCents))
                    : "",
                }))
              : [{ label: "", priceDeltaPesos: "" }],
        }))
      : buildFields(fieldCount, []);

  return {
    name: plan.name,
    internalLabel: plan.internalLabel ?? "",
    description: plan.description ?? "",
    basePricePesos: String(centsToPesos(plan.priceCents)),
    fieldCount,
    fields: buildFields(fieldCount, fields),
  };
}

export function SubscriptionPlanForm({
  tenantSlug,
  mode,
  planId,
  initialPlan,
}: {
  tenantSlug: string;
  mode: "create" | "edit";
  planId?: string;
  initialPlan?: PublicPlan;
}) {
  const defaults =
    mode === "edit" && initialPlan
      ? planToFormState(initialPlan)
      : {
          name: "",
          internalLabel: "",
          description: "",
          basePricePesos: "25000",
          fieldCount: 2,
          fields: buildFields(2, []),
        };

  const [step, setStep] = useState(1);
  const [name, setName] = useState(defaults.name);
  const [internalLabel, setInternalLabel] = useState(defaults.internalLabel);
  const [description, setDescription] = useState(defaults.description);
  const [basePricePesos, setBasePricePesos] = useState(defaults.basePricePesos);
  const [fieldCount, setFieldCount] = useState(defaults.fieldCount);
  const [fields, setFields] = useState<FieldDraft[]>(defaults.fields);

  const boundAction =
    mode === "edit" && planId
      ? updateSubscriptionAction.bind(null, tenantSlug, planId)
      : createSubscriptionAction.bind(null, tenantSlug);

  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const payload = useMemo<CreatePlanInput>(
    () => ({
      name: name.trim(),
      internalLabel: internalLabel.trim() || undefined,
      description: description.trim() || undefined,
      basePricePesos: Number(basePricePesos),
      currency: "ars",
      fieldCount,
      isActive: true,
      fields: fields.map((field) => ({
        label: field.label.trim(),
        fieldType: field.fieldType,
        affectsPrice: field.affectsPrice,
        options:
          field.fieldType === "select"
            ? field.options
                .filter((option) => option.label.trim())
                .map((option) => ({
                  label: option.label.trim(),
                  priceDeltaPesos:
                    field.affectsPrice && option.priceDeltaPesos !== ""
                      ? Number(option.priceDeltaPesos)
                      : undefined,
                }))
            : undefined,
      })),
    }),
    [name, internalLabel, description, basePricePesos, fieldCount, fields],
  );

  function updateFieldCount(count: number) {
    setFieldCount(count);
    setFields((current) => buildFields(count, current));
  }

  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  function updateOption(
    fieldIndex: number,
    optionIndex: number,
    patch: Partial<FieldDraft["options"][number]>,
  ) {
    setFields((current) =>
      current.map((field, index) => {
        if (index !== fieldIndex) {
          return field;
        }

        return {
          ...field,
          options: field.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex
              ? { ...option, ...patch }
              : option,
          ),
        };
      }),
    );
  }

  function addOption(fieldIndex: number) {
    setFields((current) =>
      current.map((field, index) =>
        index === fieldIndex
          ? {
              ...field,
              options: [...field.options, { label: "", priceDeltaPesos: "" }],
            }
          : field,
      ),
    );
  }

  const submitLabel =
    mode === "edit"
      ? pending
        ? "Guardando..."
        : "Guardar cambios"
      : pending
        ? "Publicando..."
        : "Publicar suscripción";

  return (
    <form action={formAction} className="mt-8 space-y-8">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="flex gap-2 text-sm">
        {[1, 2, 3].map((item) => (
          <span
            key={item}
            className={`rounded-full px-3 py-1 ${
              step === item
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Paso {item}
          </span>
        ))}
      </div>

      {step === 1 && (
        <section className="ori-card space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Datos de la suscripción</h2>
          <div>
            <label className="block text-sm text-gray-700">Nombre público</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="ori-input mt-1"
              placeholder="Suscripción casa"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700">
              Tipo de plan (interno)
            </label>
            <input
              value={internalLabel}
              onChange={(event) => setInternalLabel(event.target.value)}
              className="ori-input mt-1"
              placeholder="Para casa y a definir ciertos aspectos"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Detalle</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="ori-input mt-1 min-h-28"
              placeholder="Descripción que verán tus suscriptos"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Precio base (ARS)</label>
            <input
              type="number"
              min={0}
              step="1"
              value={basePricePesos}
              onChange={(event) => setBasePricePesos(event.target.value)}
              className="ori-input mt-1"
              required
            />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ori-card space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Campos del formulario</h2>
            <p className="mt-2 text-sm text-gray-600">
              Elegí cuántos campos debe completar el suscriptor (máximo 5).
            </p>
            <select
              value={fieldCount}
              onChange={(event) => updateFieldCount(Number(event.target.value))}
              className="ori-input mt-3 max-w-xs"
            >
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? "campo" : "campos"}
                </option>
              ))}
            </select>
          </div>

          {fields.map((field, fieldIndex) => (
            <div
              key={fieldIndex}
              className="space-y-4 rounded-xl border border-gray-200 p-4"
            >
              <p className="text-sm font-medium text-gray-900">
                Campo {fieldIndex + 1}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-700">Nombre del campo</label>
                  <input
                    value={field.label}
                    onChange={(event) =>
                      updateField(fieldIndex, { label: event.target.value })
                    }
                    className="ori-input mt-1"
                    placeholder="Molienda"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Tipo</label>
                  <select
                    value={field.fieldType}
                    onChange={(event) =>
                      updateField(fieldIndex, {
                        fieldType: event.target.value as "select" | "text",
                        affectsPrice:
                          event.target.value === "text" ? false : field.affectsPrice,
                      })
                    }
                    className="ori-input mt-1"
                  >
                    <option value="select">Desplegable</option>
                    <option value="text">Texto</option>
                  </select>
                </div>
              </div>

              {field.fieldType === "select" && (
                <>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={field.affectsPrice}
                      onChange={(event) =>
                        updateField(fieldIndex, {
                          affectsPrice: event.target.checked,
                        })
                      }
                    />
                    Las opciones modifican el precio (solo suman al precio base)
                  </label>

                  <div className="space-y-3">
                    {field.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className="grid gap-3 sm:grid-cols-[1fr_160px]"
                      >
                        <input
                          value={option.label}
                          onChange={(event) =>
                            updateOption(fieldIndex, optionIndex, {
                              label: event.target.value,
                            })
                          }
                          className="ori-input"
                          placeholder="Nombre de la opción"
                        />
                        {field.affectsPrice && (
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={option.priceDeltaPesos}
                            onChange={(event) =>
                              updateOption(fieldIndex, optionIndex, {
                                priceDeltaPesos: event.target.value,
                              })
                            }
                            className="ori-input"
                            placeholder="Suma en ARS"
                          />
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(fieldIndex)}
                      className="text-sm text-gray-700 underline"
                    >
                      + Agregar opción
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {step === 3 && (
        <section className="ori-card space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            {mode === "edit" ? "Revisión de cambios" : "Revisión y publicación"}
          </h2>
          <dl className="space-y-3 text-sm text-gray-700">
            <div>
              <dt className="font-medium text-gray-900">Nombre</dt>
              <dd>{name || "—"}</dd>
            </div>
            {internalLabel && (
              <div>
                <dt className="font-medium text-gray-900">Tipo interno</dt>
                <dd>{internalLabel}</dd>
              </div>
            )}
            {description && (
              <div>
                <dt className="font-medium text-gray-900">Detalle</dt>
                <dd>{description}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-900">Precio base</dt>
              <dd>${Number(basePricePesos).toLocaleString("es-AR")} ARS / mes</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Campos</dt>
              <dd>{fieldCount}</dd>
            </div>
          </dl>
          {mode === "edit" ? (
            <p className="text-sm text-gray-600">
              Los suscriptos que ya eligieron esta suscripción conservan su precio
              y opciones anteriores.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Al publicar, la suscripción quedará visible en el link público de
              registro.
            </p>
          )}
        </section>
      )}

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((current) => current - 1)}
            className="ori-btn-secondary"
          >
            Anterior
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            className="ori-btn-primary"
          >
            Siguiente
          </button>
        ) : (
          <button type="submit" disabled={pending} className="ori-btn-primary">
            {submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}

// Alias for backwards compatibility
export { SubscriptionPlanForm as CreateSubscriptionForm };
