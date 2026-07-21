"use client";

import { useActionState, useMemo, useState } from "react";

import {
  signInAndJoinAsSubscriber,
  signUpAsSubscriber,
  type JoinActionState,
} from "@/app/app/[tenantSlug]/join/actions";
import {
  createManagedSubscriberAction,
  type ManagedSubscriberState,
} from "@/app/app/[tenantSlug]/suscriptores/actions";
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
import { BillingCyclePicker } from "@/components/subscriptions/billing-cycle-picker";
import { PostalCodeField } from "@/components/subscribers/postal-code-field";
import { ProvinceLocalityFields } from "@/components/subscribers/province-locality-fields";
import Link from "next/link";

const initialJoinState: JoinActionState = { error: null };
const initialManagedState: ManagedSubscriberState = { error: null };

type AuthMode = "signup" | "login";
type CheckoutStep = "plan" | "contact" | "delivery" | "payment" | "account";

export type JoinPaymentOptions = {
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

function isContactComplete(contact: {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}) {
  return (
    contact.email.trim().includes("@") &&
    contact.phone.trim().length >= 6 &&
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

export function JoinForm({
  tenantSlug,
  plans,
  paymentOptions,
  variant = "public",
}: {
  tenantSlug: string;
  plans: PublicPlan[];
  paymentOptions: JoinPaymentOptions;
  /** Manager panel: same steps, transfer is confirmed immediately. */
  variant?: "public" | "manager";
}) {
  const isManager = variant === "manager";
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [step, setStep] = useState<CheckoutStep>("plan");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {},
  );
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [deliveryDetails, setDeliveryDetails] = useState<Record<string, string>>(
    {},
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [billingCycleDays, setBillingCycleDays] =
    useState<BillingCycleDays>(30);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(
    null,
  );
  const [mpPayerEmail, setMpPayerEmail] = useState("");
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpAsSubscriber,
    initialJoinState,
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signInAndJoinAsSubscriber,
    initialJoinState,
  );
  const [managedState, managedAction, managedPending] = useActionState(
    createManagedSubscriberAction,
    initialManagedState,
  );

  function attachReceiptAndRun(
    action: (payload: FormData) => void,
    formData: FormData,
  ) {
    if (paymentReceiptFile) {
      formData.set("paymentReceipt", paymentReceiptFile);
    }
    action(formData);
  }

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

  const contact = { email, phone, firstName, lastName };
  const contactComplete = isContactComplete(contact);
  const deliveryComplete = isDeliveryComplete(deliveryMethod, deliveryDetails);
  const paymentComplete =
    ((paymentMethod === "card_monthly" || paymentMethod === "card_annual") &&
      mpPayerEmail.trim().includes("@")) ||
    (paymentMethod === "transfer" &&
      (isManager ||
        paymentReference.trim().length > 0 ||
        paymentReceiptFile !== null));

  const checkoutPayload: CheckoutDetailsInput | null =
    deliveryMethod &&
    deliveryMethod !== "store_pickup" &&
    paymentMethod
      ? {
          email: email.trim(),
          phone: phone.trim(),
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

  const error = isManager
    ? managedState.error
    : authMode === "signup"
      ? signUpState.error
      : signInState.error;
  const pending = isManager
    ? managedPending
    : authMode === "signup"
      ? signUpPending
      : signInPending;
  const planReady = Boolean(selectedPlanId) && fieldsComplete;

  if (isManager && managedState.success && managedState.userId) {
    return (
      <div className="mt-8 ori-card space-y-4">
        <p className="text-sm font-medium text-gray-900">
          {managedState.success}
        </p>
        <p className="text-sm text-gray-600">
          La transferencia quedó confirmada y la suscripción activa.
        </p>
        <Link
          href={`/app/${tenantSlug}/suscriptores/${managedState.userId}`}
          className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Ver ficha del suscriptor
        </Link>
        <Link
          href={`/app/${tenantSlug}/suscriptores`}
          className="block text-sm text-gray-600 underline-offset-4 hover:underline"
        >
          Volver a suscriptores
        </Link>
      </div>
    );
  }

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

  const allSteps = [
    ["plan", "Experiencia"],
    ["contact", "Contacto"],
    ["delivery", "Entrega"],
    ["payment", "Pago"],
    ["account", "Cuenta"],
  ] as const;
  // Until a plan is picked, only show the first step to keep the screen clean.
  const visibleSteps = selectedPlanId ? allSteps : allSteps.slice(0, 1);
  const currentStepIndex = allSteps.findIndex(([key]) => key === step);

  return (
    <div className="mt-2">
      <ol className="mb-8 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:justify-start">
        {visibleSteps.map(([key, label], index) => {
          const isCurrent = step === key;
          const isDone = index < currentStepIndex;
          return (
            <li key={key} className="flex items-center">
              {index > 0 && (
                <span
                  className={`mx-1 h-px w-4 sm:w-6 ${
                    isDone || isCurrent ? "bg-gray-900" : "bg-gray-200"
                  }`}
                  aria-hidden
                />
              )}
              <span
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs transition ${
                  isCurrent
                    ? "bg-gray-900 text-white shadow-sm"
                    : isDone
                      ? "bg-gray-100 text-gray-900"
                      : "bg-gray-50 text-gray-400"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-semibold ${
                    isCurrent
                      ? "bg-white text-gray-900"
                      : isDone
                        ? "bg-gray-900 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <span className={isCurrent ? "font-medium" : ""}>{label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {step === "plan" && (
        <>
          <fieldset>
            <legend className="sr-only">Elegí tu experiencia Orí</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={`ori-product-card ${
                    selectedPlanId === plan.id ? "ori-product-card-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="planChoice"
                    value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => handlePlanChange(plan.id)}
                    className="sr-only"
                  />
                  <span className="text-lg font-semibold tracking-tight text-gray-900">
                    {plan.name}
                  </span>
                  <span className="mt-2 block text-base font-medium text-gray-900">
                    {formatPlanPrice(plan)}
                  </span>
                  {plan.description && (
                    <span className="mt-2 block text-sm text-gray-500">
                      {plan.description}
                    </span>
                  )}
                  <span className="mt-4 inline-block text-sm font-medium text-blue-600">
                    {selectedPlanId === plan.id
                      ? "Tu elección"
                      : "Elegir experiencia"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {!selectedPlanId && (
            <p className="mt-4 text-center text-sm text-gray-500 sm:text-left">
              Elegí una experiencia para continuar.
            </p>
          )}

          {selectedPlan && selectedPlan.fields.length > 0 && (
            <fieldset className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
              <legend className="px-1 text-sm font-medium text-gray-900">
                Personalizá tu experiencia
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
                    selectedPlan.interval,
                  )}
                </p>
              )}
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
            <label htmlFor="contactEmail" className="block text-sm text-gray-700">
              Correo electrónico
            </label>
            <input
              id="contactEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="ori-input mt-1"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className="block text-sm text-gray-700">
              Número de teléfono
            </label>
            <input
              id="contactPhone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="ori-input mt-1"
              autoComplete="tel"
              required
            />
          </div>
          <div>
            <label htmlFor="contactFirstName" className="block text-sm text-gray-700">
              Nombre
            </label>
            <input
              id="contactFirstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="ori-input mt-1"
              autoComplete="given-name"
              required
            />
          </div>
          <div>
            <label htmlFor="contactLastName" className="block text-sm text-gray-700">
              Apellido
            </label>
            <input
              id="contactLastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="ori-input mt-1"
              autoComplete="family-name"
              required
            />
          </div>
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
                ["shipping", "Envío"],
                ["andreani", "Sucursal Andreani"],
                ["store_pickup", "Retiro en tienda amiga"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
                  deliveryMethod === value
                    ? "border-gray-900 bg-gray-100"
                    : "border-gray-200"
                } ${value === "store_pickup" ? "opacity-70" : ""}`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value={value}
                  checked={deliveryMethod === value}
                  onChange={() => handleDeliveryMethodChange(value)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-900">{label}</span>
                  {value === "store_pickup" && (
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
                <Field
                  label="Dirección"
                  value={deliveryDetails.address ?? ""}
                  onChange={(value) => updateDeliveryDetail("address", value)}
                />
                <Field
                  label="Barrio (opcional)"
                  value={deliveryDetails.neighborhood ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("neighborhood", value)
                  }
                  required={false}
                />
                <Field
                  label="Depto (opcional)"
                  value={deliveryDetails.apartment ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("apartment", value)
                  }
                  required={false}
                />
              </div>
            </div>
          )}

          {deliveryMethod === "andreani" && (
            <div className="space-y-4">
              <ProvinceLocalityFields
                provinceId="andreani-province"
                localityId="andreani-locality"
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
                  id="andreani-postal-code"
                  label="Código postal (para elegir tu sucursal más cercana)"
                  value={deliveryDetails.postalCode ?? ""}
                  onChange={(value) =>
                    updateDeliveryDetail("postalCode", value)
                  }
                />
                <Field
                  label="Dirección"
                  value={deliveryDetails.address ?? ""}
                  onChange={(value) => updateDeliveryDetail("address", value)}
                />
                <Field
                  label="Número"
                  value={deliveryDetails.number ?? ""}
                  onChange={(value) => updateDeliveryDetail("number", value)}
                />
              </div>
            </div>
          )}

          {deliveryMethod === "store_pickup" && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Retiro en tienda amiga estará disponible próximamente. Elegí Envío o
              Sucursal Andreani para continuar.
            </p>
          )}

          <StepNav
            onBack={() => setStep("contact")}
            onNext={() => setStep("payment")}
            nextDisabled={!deliveryComplete}
          />
        </section>
      )}

      {step === "payment" && (
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
            !paymentOptions.cardsEnabled &&
            !paymentOptions.transferEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este comercio todavía no configuró pagos. Pedile que conecte
              Mercado Pago en su panel.
            </p>
          )}

          <div className="space-y-3">
            {paymentOptions.cardsEnabled && (
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
            {paymentOptions.transferEnabled && (
              <PaymentOption
                checked={paymentMethod === "transfer"}
                onChange={() => setPaymentMethod("transfer")}
                title="Transferencia"
                description={
                  isManager
                    ? "Queda confirmada al instante (activa). Podés cargar número u opcionalmente el comprobante."
                    : "Te mostramos CBU/alias para transferir. Queda pendiente de confirmación."
                }
              />
            )}
            {isManager && !paymentOptions.transferEnabled && (
              <PaymentOption
                checked={paymentMethod === "transfer"}
                onChange={() => setPaymentMethod("transfer")}
                title="Transferencia"
                description="Se confirma al instante aunque todavía no hayas cargado CBU/alias en Pagos."
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
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="paymentReference"
                    className="block text-sm text-gray-700"
                  >
                    Número de operación / transacción
                    {isManager ? " (opcional)" : ""}
                  </label>
                  <input
                    id="paymentReference"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    className="ori-input mt-1"
                    placeholder="Ej. 123456789"
                  />
                </div>
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
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setPaymentReceiptFile(file);
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
                    ? "Al suscribir desde el panel, la transferencia se confirma sola y la suscripción queda activa."
                    : "Completá al menos uno: número de operación o comprobante. La suscripción queda pendiente hasta que el comercio confirme el pago."}
                </p>
              </div>
            </div>
          )}

          {(paymentMethod === "card_monthly" ||
            paymentMethod === "card_annual") && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div>
                <label
                  htmlFor="mpPayerEmail"
                  className="block text-sm text-gray-700"
                >
                  Email de tu cuenta de Mercado Pago
                </label>
                <input
                  id="mpPayerEmail"
                  type="email"
                  value={mpPayerEmail}
                  onChange={(event) => setMpPayerEmail(event.target.value)}
                  onFocus={() => {
                    if (!mpPayerEmail.trim() && email.trim()) {
                      setMpPayerEmail(email.trim());
                    }
                  }}
                  className="ori-input mt-1"
                  placeholder="el email con el que entrás a Mercado Pago"
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Puede ser distinto al email con el que te registrás en Ori.
                  Mercado Pago usa este email para el cobro.
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Al finalizar el registro te vamos a llevar a Mercado Pago para
                cargar tu tarjeta y autorizar el cobro recurrente.
              </p>
            </div>
          )}

          <StepNav
            onBack={() => setStep("delivery")}
            onNext={() => setStep("account")}
            nextDisabled={!paymentComplete}
          />
        </section>
      )}

      {step === "account" && checkoutPayload && (
        <>
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p>
              {firstName} {lastName} · {email} · {phone}
            </p>
            <p className="mt-1">
              Entrega:{" "}
              {deliveryMethod === "shipping"
                ? "Envío"
                : deliveryMethod === "andreani"
                  ? "Sucursal Andreani"
                  : "—"}
            </p>
          </div>

          <div className="flex rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${
                authMode === "signup"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Crear cuenta
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${
                authMode === "login"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {isManager ? "Ya tiene cuenta" : "Ya tengo cuenta"}
            </button>
          </div>

          {authMode === "signup" ? (
            <form
              action={(formData) =>
                attachReceiptAndRun(
                  isManager ? managedAction : signUpAction,
                  formData,
                )
              }
              className="mt-6 space-y-4"
            >
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="planId" value={selectedPlanId} />
              <input type="hidden" name="authMode" value="signup" />
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
              <div>
                <label htmlFor="password" className="block text-sm text-gray-700">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="ori-input mt-1"
                />
                {isManager && (
                  <p className="mt-1 text-xs text-gray-500">
                    Es la contraseña con la que esa persona va a entrar a su
                    panel.
                  </p>
                )}
              </div>
              <SubmitButton
                pending={pending}
                label={
                  isManager
                    ? "Suscribir"
                    : "Crear cuenta y verificar email"
                }
              />
            </form>
          ) : (
            <form
              action={(formData) =>
                attachReceiptAndRun(
                  isManager ? managedAction : signInAction,
                  formData,
                )
              }
              className="mt-6 space-y-4"
            >
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="planId" value={selectedPlanId} />
              <input type="hidden" name="authMode" value="login" />
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
              <input type="hidden" name="email" value={email} />
              {isManager ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  Se va a suscribir la cuenta con email{" "}
                  <span className="font-medium text-gray-900">{email}</span>.
                  No hace falta la contraseña.
                </p>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="loginPassword"
                      className="block text-sm text-gray-700"
                    >
                      Contraseña
                    </label>
                    <a
                      href={`/auth/forgot-password?next=${encodeURIComponent(`/app/${tenantSlug}`)}`}
                      className="text-xs text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  <input
                    id="loginPassword"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="ori-input mt-1"
                  />
                </div>
              )}
              <SubmitButton
                pending={pending}
                label={
                  isManager
                    ? "Suscribir con cuenta existente"
                    : "Iniciar sesión y suscribirme"
                }
              />
            </form>
          )}

          <button
            type="button"
            onClick={() => setStep("payment")}
            className="ori-btn-secondary mt-4 w-full"
          >
            Anterior
          </button>
        </>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
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

function Field({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-gray-700">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ori-input mt-1"
        required={required}
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

function SubmitButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="ori-btn-primary w-full disabled:opacity-60"
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}
