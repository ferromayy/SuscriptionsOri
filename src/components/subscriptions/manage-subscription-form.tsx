"use client";

import { useActionState, useMemo, useState } from "react";

import {
  subscribeLoggedInSubscriber,
  type SubscriptionActionState,
} from "@/app/app/[tenantSlug]/mi-suscripcion/actions";
import {
  managerUpsertSubscriptionAction,
  type ManagerUpsertState,
} from "@/app/app/[tenantSlug]/suscriptores/actions";
import { BillingCyclePicker } from "@/components/subscriptions/billing-cycle-picker";
import {
  calculateLivePlanPrice,
  formatPlanPrice,
} from "@/lib/plans/format-price";
import { formatCents } from "@/lib/plans/money";
import type { PublicPlan } from "@/lib/plans/get-plans";
import type { FieldChoiceInput } from "@/lib/plans/schemas";
import type {
  CheckoutDetailsInput,
  DeliveryMethod,
  PaymentMethod,
  BillingCycleDays,
} from "@/lib/subscribers/checkout-schemas";
import { isValidArgentinePostalCode } from "@/lib/subscribers/argentine-postal-code";
import {
  LOCAL_PHONE_HINT,
  emailValidationMessage,
  isValidEmail,
  isValidLocalArgentinePhone,
  maskLocalPhoneInput,
  normalizeLocalArgentinePhone,
  phoneValidationMessage,
} from "@/lib/subscribers/contact-validation";
import { normalizeBillingCycleDays } from "@/lib/subscribers/billing-cycle";
import { PostalCodeField } from "@/components/subscribers/postal-code-field";
import { ProvinceLocalityFields } from "@/components/subscribers/province-locality-fields";

const initialState: SubscriptionActionState = { error: null };
const managerInitialState: ManagerUpsertState = { error: null };

type AddStep = "plan" | "contact" | "delivery" | "payment";

export type ManagePaymentOptions = {
  cardsEnabled: boolean;
  transferEnabled: boolean;
  transferAlias: string | null;
  transferCbu: string | null;
  transferHolderName: string | null;
};

function buildFieldChoices(
  plan: PublicPlan | undefined,
  selectedOptions: Record<string, string>,
  textValues: Record<string, string>,
): FieldChoiceInput[] {
  if (!plan) {
    return [];
  }

  return plan.fields.map((field) => {
    if (field.fieldType === "select") {
      return {
        fieldId: field.id,
        optionId: selectedOptions[field.id],
      };
    }

    return {
      fieldId: field.id,
      textValue: textValues[field.id] ?? "",
    };
  });
}

function arePlanFieldsComplete(
  plan: PublicPlan | undefined,
  selectedOptions: Record<string, string>,
  textValues: Record<string, string>,
): boolean {
  if (!plan) {
    return false;
  }

  return plan.fields.every((field) => {
    if (field.fieldType === "select") {
      return Boolean(selectedOptions[field.id]);
    }

    return Boolean(textValues[field.id]?.trim());
  });
}

function choicesToInitialState(choices: SubscriptionChoiceSeed[]) {
  const selectedOptions: Record<string, string> = {};
  const textValues: Record<string, string> = {};

  for (const choice of choices) {
    if (choice.optionId) {
      selectedOptions[choice.fieldId] = choice.optionId;
    }
    if (choice.textValue) {
      textValues[choice.fieldId] = choice.textValue;
    }
  }

  return { selectedOptions, textValues };
}

type SubscriptionChoiceSeed = {
  fieldId: string;
  optionId: string | null;
  textValue: string | null;
};

function isContactComplete(contact: {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}) {
  return (
    isValidEmail(contact.email) &&
    isValidLocalArgentinePhone(contact.phone) &&
    contact.firstName.trim().length > 0 &&
    contact.lastName.trim().length > 0
  );
}

function isDeliveryComplete(
  method: DeliveryMethod | "",
  details: Record<string, string>,
) {
  const hasPlace =
    Boolean(details.province?.trim()) && Boolean(details.locality?.trim());

  if (method === "shipping") {
    return Boolean(
      hasPlace &&
        isValidArgentinePostalCode(details.postalCode ?? "") &&
        details.address?.trim(),
    );
  }

  if (method === "andreani") {
    return Boolean(
      hasPlace &&
        isValidArgentinePostalCode(details.postalCode ?? "") &&
        details.address?.trim() &&
        details.number?.trim(),
    );
  }

  return false;
}

export function ManageSubscriptionForm({
  tenantSlug,
  plans,
  mode,
  lockedPlanId,
  initialChoices = [],
  submitLabel,
  paymentOptions,
  actingAsUserId,
  initialContact,
  initialBillingCycleDays = 30,
}: {
  tenantSlug: string;
  plans: PublicPlan[];
  mode: "add" | "edit";
  lockedPlanId?: string;
  initialChoices?: SubscriptionChoiceSeed[];
  submitLabel: string;
  paymentOptions?: ManagePaymentOptions;
  actingAsUserId?: string;
  initialContact?: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  } | null;
  initialBillingCycleDays?: BillingCycleDays | null;
}) {
  const isManager = Boolean(actingAsUserId);
  const initial = choicesToInitialState(initialChoices);
  const [step, setStep] = useState<AddStep>("plan");
  const [selectedPlanId, setSelectedPlanId] = useState(lockedPlanId ?? "");
  const [selectedOptions, setSelectedOptions] = useState(
    initial.selectedOptions,
  );
  const [textValues, setTextValues] = useState(initial.textValues);
  const [email, setEmail] = useState(initialContact?.email ?? "");
  const [phone, setPhone] = useState(initialContact?.phone ?? "");
  const [firstName, setFirstName] = useState(initialContact?.firstName ?? "");
  const [lastName, setLastName] = useState(initialContact?.lastName ?? "");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [deliveryDetails, setDeliveryDetails] = useState<Record<string, string>>(
    {},
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [billingCycleDays, setBillingCycleDays] = useState<BillingCycleDays>(
    normalizeBillingCycleDays(initialBillingCycleDays),
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(
    null,
  );
  const [mpPayerEmail, setMpPayerEmail] = useState("");
  const [subscriberState, subscriberAction, subscriberPending] = useActionState(
    subscribeLoggedInSubscriber,
    initialState,
  );
  const [managerState, managerAction, managerPending] = useActionState(
    managerUpsertSubscriptionAction,
    managerInitialState,
  );
  const state = isManager ? managerState : subscriberState;
  const formAction = isManager ? managerAction : subscriberAction;
  const pending = isManager ? managerPending : subscriberPending;

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const fieldChoices = useMemo(
    () => buildFieldChoices(selectedPlan, selectedOptions, textValues),
    [selectedPlan, selectedOptions, textValues],
  );
  const fieldsComplete = arePlanFieldsComplete(
    selectedPlan,
    selectedOptions,
    textValues,
  );
  const livePrice = selectedPlan
    ? calculateLivePlanPrice(selectedPlan, selectedOptions)
    : 0;
  const planReady = Boolean(selectedPlanId) && fieldsComplete;
  const contactComplete = isContactComplete({
    email,
    phone,
    firstName,
    lastName,
  });
  const deliveryComplete = isDeliveryComplete(deliveryMethod, deliveryDetails);
  const paymentComplete =
    ((paymentMethod === "card_monthly" || paymentMethod === "card_annual") &&
      mpPayerEmail.trim().includes("@")) ||
    (paymentMethod === "transfer" &&
      (isManager ||
        paymentReference.trim().length > 0 ||
        paymentReceiptFile !== null));

  const checkoutPayload: CheckoutDetailsInput | null =
    mode === "add" &&
    deliveryMethod &&
    deliveryMethod !== "store_pickup" &&
    paymentMethod
      ? {
          email: email.trim(),
          phone: normalizeLocalArgentinePhone(phone),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          deliveryMethod,
          deliveryDetails,
          billingCycleDays,
          paymentMethod,
          paymentReference:
            paymentReference.trim() ||
            (isManager ? "Confirmado por el comercio" : undefined),
          mpPayerEmail:
            paymentMethod === "card_monthly" || paymentMethod === "card_annual"
              ? mpPayerEmail.trim()
              : undefined,
        }
      : null;

  function handlePlanChange(planId: string) {
    setSelectedPlanId(planId);
    setSelectedOptions({});
    setTextValues({});
  }

  function updateDeliveryDetail(key: string, value: string) {
    setDeliveryDetails((current) => ({ ...current, [key]: value }));
  }

  function handleDeliveryMethodChange(method: DeliveryMethod) {
    setDeliveryMethod(method);
    setDeliveryDetails({});
  }

  if (mode === "edit") {
    return (
      <div className="mt-8">
        {selectedPlan && (
          <div className="ori-card">
            <p className="text-sm text-gray-600">Suscripción</p>
            <p className="mt-2 text-xl font-semibold text-gray-900">
              {selectedPlan.name}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {formatPlanPrice(selectedPlan)}
            </p>
          </div>
        )}

        {selectedPlan && selectedPlan.fields.length > 0 && (
          <fieldset className="mt-6 space-y-4 rounded-lg border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-900">
              Actualizá las opciones
            </legend>
            {selectedPlan.fields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={`field-${field.id}`}
                  className="block text-sm text-gray-700"
                >
                  {field.label}
                </label>
                {field.fieldType === "select" ? (
                  <select
                    id={`field-${field.id}`}
                    value={selectedOptions[field.id] ?? ""}
                    onChange={(event) =>
                      setSelectedOptions((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                    className="ori-input mt-1"
                    required
                  >
                    <option value="">Elegí una opción</option>
                    {field.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                        {field.affectsPrice && option.priceDeltaCents > 0
                          ? ` (+${formatCents(option.priceDeltaCents, selectedPlan.currency).replace(/ \/ mes$/, "")})`
                          : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`field-${field.id}`}
                    value={textValues[field.id] ?? ""}
                    onChange={(event) =>
                      setTextValues((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                    className="ori-input mt-1"
                    required
                  />
                )}
              </div>
            ))}
            {fieldsComplete && (
              <p className="text-sm font-medium text-gray-900">
                Total:{" "}
                {formatCents(
                  livePrice,
                  selectedPlan.currency,
                  billingCycleDays,
                )}
              </p>
            )}
          </fieldset>
        )}

        <div className="mt-6 ori-card">
          <BillingCyclePicker
            value={billingCycleDays}
            onChange={setBillingCycleDays}
            priceCents={livePrice}
            currency={selectedPlan?.currency}
          />
          <p className="mt-3 text-xs text-gray-500">
            El cambio aplica para el próximo envío / cobro.
          </p>
        </div>

        {planReady && (
          <form action={formAction} className="mt-6">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="planId" value={selectedPlanId} />
            <input type="hidden" name="requireCheckout" value="0" />
            <input
              type="hidden"
              name="billingCycleDays"
              value={billingCycleDays}
            />
            {actingAsUserId && (
              <input type="hidden" name="targetUserId" value={actingAsUserId} />
            )}
            <input
              type="hidden"
              name="fieldChoices"
              value={JSON.stringify(fieldChoices)}
            />
            <button
              type="submit"
              disabled={pending}
              className="ori-btn-primary w-full disabled:opacity-60"
            >
              {pending ? "Guardando..." : submitLabel}
            </button>
          </form>
        )}

        {state.error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["plan", "1. Suscripción"],
            ["contact", "2. Contacto"],
            ["delivery", "3. Entrega"],
            ["payment", "4. Pago"],
          ] as const
        ).map(([key, label]) => (
          <span
            key={key}
            className={`rounded-full px-3 py-1 ${
              step === key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {step === "plan" && (
        <>
          <fieldset className="space-y-3">
            <legend className="text-sm text-gray-700">Elegí una suscripción</legend>
            {plans.map((plan) => (
              <label
                key={plan.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
                  selectedPlanId === plan.id
                    ? "border-gray-900 bg-gray-100"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="planChoice"
                  value={plan.id}
                  checked={selectedPlanId === plan.id}
                  onChange={() => handlePlanChange(plan.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-900">{plan.name}</span>
                  <span className="block text-sm text-gray-600">
                    {formatPlanPrice(plan)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {selectedPlan && selectedPlan.fields.length > 0 && (
            <fieldset className="mt-6 space-y-4 rounded-lg border border-gray-200 p-4">
              <legend className="px-1 text-sm font-medium text-gray-900">
                Personalizá tu suscripción
              </legend>
              {selectedPlan.fields.map((field) => (
                <div key={field.id}>
                  <label
                    htmlFor={`add-field-${field.id}`}
                    className="block text-sm text-gray-700"
                  >
                    {field.label}
                  </label>
                  {field.fieldType === "select" ? (
                    <select
                      id={`add-field-${field.id}`}
                      value={selectedOptions[field.id] ?? ""}
                      onChange={(event) =>
                        setSelectedOptions((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }))
                      }
                      className="ori-input mt-1"
                    >
                      <option value="">Elegí una opción</option>
                      {field.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`add-field-${field.id}`}
                      value={textValues[field.id] ?? ""}
                      onChange={(event) =>
                        setTextValues((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }))
                      }
                      className="ori-input mt-1"
                    />
                  )}
                </div>
              ))}
            </fieldset>
          )}

          {planReady && (
            <button
              type="button"
              onClick={() => setStep("contact")}
              className="ori-btn-primary mt-6 w-full"
            >
              Continuar
            </button>
          )}
        </>
      )}

      {step === "contact" && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Datos de contacto</h2>
          <div>
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={setEmail}
            />
            {emailValidationMessage(email) && (
              <p className="mt-1 text-xs text-red-600">
                {emailValidationMessage(email)}
              </p>
            )}
          </div>
          <div>
            <Input
              label="Número de teléfono"
              value={phone}
              onChange={(value) => setPhone(maskLocalPhoneInput(value))}
            />
            <p className="mt-1 text-xs text-gray-500">{LOCAL_PHONE_HINT}</p>
            {phoneValidationMessage(phone) && (
              <p className="mt-1 text-xs text-red-600">
                {phoneValidationMessage(phone)}
              </p>
            )}
          </div>
          <Input label="Nombre" value={firstName} onChange={setFirstName} />
          <Input label="Apellido" value={lastName} onChange={setLastName} />
          <StepNav
            onBack={() => setStep("plan")}
            onNext={() => setStep("delivery")}
            nextDisabled={!contactComplete}
          />
        </section>
      )}

      {step === "delivery" && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Método de entrega</h2>
          <div className="space-y-3">
            {(
              [
                ["shipping", "Envío", true],
                ["andreani", "Sucursal Andreani", false],
                ["store_pickup", "Retiro en tienda amiga", false],
              ] as const
            ).map(([value, label, enabled]) => (
              <label
                key={value}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                  enabled
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-60"
                } ${
                  deliveryMethod === value
                    ? "border-gray-900 bg-gray-100"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value={value}
                  checked={deliveryMethod === value}
                  onChange={() => handleDeliveryMethodChange(value)}
                  disabled={!enabled}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-900">{label}</span>
                  {!enabled && (
                    <span className="mt-1 block text-xs text-gray-500">
                      Próximamente
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          {deliveryMethod === "shipping" && (
            <div className="space-y-4">
              <ProvinceLocalityFields
                province={deliveryDetails.province ?? ""}
                locality={deliveryDetails.locality ?? ""}
                onProvinceChange={(value) =>
                  updateDeliveryDetail("province", value)
                }
                onLocalityChange={(value) =>
                  updateDeliveryDetail("locality", value)
                }
              />
              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <PostalCodeField
                  value={deliveryDetails.postalCode ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("postalCode", value)
                  }
                />
                <Input
                  label="Dirección"
                  value={deliveryDetails.address ?? ""}
                  onChange={(value) => updateDeliveryDetail("address", value)}
                />
                <Input
                  label="Barrio (opcional)"
                  value={deliveryDetails.neighborhood ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("neighborhood", value)
                  }
                />
                <Input
                  label="Depto (opcional)"
                  value={deliveryDetails.apartment ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("apartment", value)
                  }
                />
              </div>
            </div>
          )}

          {deliveryMethod === "andreani" && (
            <div className="space-y-4">
              <ProvinceLocalityFields
                provinceId="manage-andreani-province"
                localityId="manage-andreani-locality"
                province={deliveryDetails.province ?? ""}
                locality={deliveryDetails.locality ?? ""}
                onProvinceChange={(value) =>
                  updateDeliveryDetail("province", value)
                }
                onLocalityChange={(value) =>
                  updateDeliveryDetail("locality", value)
                }
              />
              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <PostalCodeField
                  id="manage-andreani-postal-code"
                  label="Código postal (para elegir tu sucursal más cercana)"
                  value={deliveryDetails.postalCode ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("postalCode", value)
                  }
                />
                <Input
                  label="Dirección"
                  value={deliveryDetails.address ?? ""}
                  onChange={(value) => updateDeliveryDetail("address", value)}
                />
                <Input
                  label="Número"
                  value={deliveryDetails.number ?? ""}
                  onChange={(value) => updateDeliveryDetail("number", value)}
                />
              </div>
            </div>
          )}

          {deliveryMethod === "store_pickup" && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Retiro en tienda amiga estará disponible próximamente.
            </p>
          )}

          <StepNav
            onBack={() => setStep("contact")}
            onNext={() => setStep("payment")}
            nextDisabled={!deliveryComplete}
          />
        </section>
      )}

      {step === "payment" && paymentOptions && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Pago y frecuencia</h2>
          {selectedPlan && (
            <p className="text-sm text-gray-600">
              Precio por ciclo:{" "}
              <span className="font-medium text-gray-900">
                {formatCents(livePrice, selectedPlan.currency, billingCycleDays)}
              </span>
            </p>
          )}

          <BillingCyclePicker
            value={billingCycleDays}
            onChange={setBillingCycleDays}
            priceCents={livePrice}
            currency={selectedPlan?.currency}
          />

          {!isManager &&
            !paymentOptions?.cardsEnabled &&
            !paymentOptions?.transferEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este comercio todavía no configuró pagos. Pedile que conecte
              Mercado Pago en su panel.
            </p>
          )}

          <div className="space-y-3">
            {paymentOptions?.cardsEnabled && (
              <>
                <PaymentOption
                  checked={paymentMethod === "card_monthly"}
                  onChange={() => setPaymentMethod("card_monthly")}
                  title="Mensual con tarjeta"
                  description="Cobro automático cada mes con Mercado Pago."
                />
                <PaymentOption
                  checked={paymentMethod === "card_annual"}
                  onChange={() => setPaymentMethod("card_annual")}
                  title="Anual con tarjeta"
                  description={
                    selectedPlan
                      ? `Cobro anual de ${formatCents(livePrice * 12, selectedPlan.currency, "year")}.`
                      : "Cobro automático una vez al año."
                  }
                />
              </>
            )}
            {(paymentOptions?.transferEnabled || isManager) && (
              <PaymentOption
                checked={paymentMethod === "transfer"}
                onChange={() => setPaymentMethod("transfer")}
                title="Transferencia"
                description={
                  isManager
                    ? "Se confirma al instante y la suscripción queda activa."
                    : "Te mostramos CBU/alias para transferir. Queda pendiente de confirmación."
                }
              />
            )}
          </div>

          {paymentMethod === "transfer" && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
              {paymentOptions.transferHolderName && (
                <p>
                  <span className="font-medium">Titular:</span>{" "}
                  {paymentOptions.transferHolderName}
                </p>
              )}
              {paymentOptions.transferAlias && (
                <p>
                  <span className="font-medium">Alias:</span>{" "}
                  {paymentOptions.transferAlias}
                </p>
              )}
              {paymentOptions.transferCbu && (
                <p>
                  <span className="font-medium">CBU/CVU:</span>{" "}
                  {paymentOptions.transferCbu}
                </p>
              )}
              <Input
                label={
                  isManager
                    ? "Número de operación / transacción (opcional)"
                    : "Número de operación / transacción"
                }
                value={paymentReference}
                onChange={setPaymentReference}
              />
              <div>
                <label
                  htmlFor="paymentReceipt"
                  className="block text-sm text-gray-700"
                >
                  Comprobante (PDF o imagen)
                  {isManager ? " (opcional)" : ""}
                </label>
                <input
                  id="paymentReceipt"
                  name="paymentReceipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    setPaymentReceiptFile(event.target.files?.[0] ?? null);
                  }}
                  className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                />
                {paymentReceiptFile && (
                  <p className="mt-1 text-xs text-gray-500">
                    Archivo: {paymentReceiptFile.name}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {isManager
                  ? "Al guardar desde el panel, la transferencia queda confirmada."
                  : "Completá al menos uno: número de operación o comprobante."}
              </p>
            </div>
          )}

          {(paymentMethod === "card_monthly" ||
            paymentMethod === "card_annual") && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <Input
                label="Email de tu cuenta de Mercado Pago"
                value={mpPayerEmail}
                onChange={setMpPayerEmail}
                type="email"
              />
              <p className="text-xs text-gray-500">
                Puede ser distinto al email de Ori. Mercado Pago usa este email
                para el cobro. Al confirmar te vamos a llevar a autorizar la
                tarjeta.
              </p>
            </div>
          )}

          <form
            action={(formData) => {
              if (paymentReceiptFile) {
                formData.set("paymentReceipt", paymentReceiptFile);
              }
              formAction(formData);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="planId" value={selectedPlanId} />
            <input type="hidden" name="requireCheckout" value="1" />
            {actingAsUserId && (
              <input type="hidden" name="targetUserId" value={actingAsUserId} />
            )}
            <input
              type="hidden"
              name="fieldChoices"
              value={JSON.stringify(fieldChoices)}
            />
            <input
              type="hidden"
              name="checkout"
              value={JSON.stringify(checkoutPayload)}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep("delivery")}
                className="ori-btn-secondary"
              >
                Anterior
              </button>
              <button
                type="submit"
                disabled={pending || !paymentComplete}
                className="ori-btn-primary disabled:opacity-60"
              >
                {pending ? "Guardando..." : submitLabel}
              </button>
            </div>
          </form>
        </section>
      )}

      {state.error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

function PaymentOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
        checked ? "border-gray-900 bg-gray-100" : "border-gray-200"
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onChange}
        className="mt-1"
      />
      <span>
        <span className="block font-medium text-gray-900">{title}</span>
        <span className="mt-1 block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ori-input mt-1"
      />
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3 pt-2">
      <button type="button" onClick={onBack} className="ori-btn-secondary">
        Anterior
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="ori-btn-primary disabled:opacity-60"
      >
        Continuar
      </button>
    </div>
  );
}
