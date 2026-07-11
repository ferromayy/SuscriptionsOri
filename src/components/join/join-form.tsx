"use client";

import { useActionState, useMemo, useState } from "react";

import {
  signInAndJoinAsSubscriber,
  signUpAsSubscriber,
  type JoinActionState,
} from "@/app/app/[tenantSlug]/join/actions";
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
} from "@/lib/subscribers/checkout-schemas";

const initialState: JoinActionState = { error: null };

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
  if (method === "shipping") {
    return Boolean(
      details.province?.trim() &&
        details.neighborhood?.trim() &&
        details.postalCode?.trim() &&
        details.address?.trim(),
    );
  }

  if (method === "andreani") {
    return Boolean(
      details.postalCode?.trim() &&
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
}: {
  tenantSlug: string;
  plans: PublicPlan[];
  paymentOptions: JoinPaymentOptions;
}) {
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
  const [paymentReference, setPaymentReference] = useState("");
  const [mpPayerEmail, setMpPayerEmail] = useState("");
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpAsSubscriber,
    initialState,
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signInAndJoinAsSubscriber,
    initialState,
  );

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
    (paymentMethod === "transfer" && paymentReference.trim().length > 0);

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
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          mpPayerEmail:
            paymentMethod === "card_monthly" || paymentMethod === "card_annual"
              ? mpPayerEmail.trim()
              : undefined,
        }
      : null;

  const error = authMode === "signup" ? signUpState.error : signInState.error;
  const pending = authMode === "signup" ? signUpPending : signInPending;
  const planReady = Boolean(selectedPlanId) && fieldsComplete;

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

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["plan", "1. Suscripción"],
            ["contact", "2. Contacto"],
            ["delivery", "3. Entrega"],
            ["payment", "4. Pago"],
            ["account", "5. Cuenta"],
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
                  {plan.description && (
                    <span className="mt-1 block text-xs text-gray-500">
                      {plan.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>

          {!selectedPlanId && (
            <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Elegí una suscripción para continuar.
            </p>
          )}

          {selectedPlan && selectedPlan.fields.length > 0 && (
            <fieldset className="mt-6 space-y-4 rounded-lg border border-gray-200 p-4">
              <legend className="px-1 text-sm font-medium text-gray-900">
                Personalizá tu suscripción
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
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <Field
                label="Provincia"
                value={deliveryDetails.province ?? ""}
                onChange={(value) => updateDeliveryDetail("province", value)}
              />
              <Field
                label="Barrio"
                value={deliveryDetails.neighborhood ?? ""}
                onChange={(value) => updateDeliveryDetail("neighborhood", value)}
              />
              <Field
                label="Código postal"
                value={deliveryDetails.postalCode ?? ""}
                onChange={(value) => updateDeliveryDetail("postalCode", value)}
              />
              <Field
                label="Dirección"
                value={deliveryDetails.address ?? ""}
                onChange={(value) => updateDeliveryDetail("address", value)}
              />
              <Field
                label="Depto"
                value={deliveryDetails.apartment ?? ""}
                onChange={(value) => updateDeliveryDetail("apartment", value)}
                required={false}
              />
            </div>
          )}

          {deliveryMethod === "andreani" && (
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <Field
                label="Código postal (para elegir tu sucursal más cercana)"
                value={deliveryDetails.postalCode ?? ""}
                onChange={(value) => updateDeliveryDetail("postalCode", value)}
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
          <h2 className="text-lg font-medium text-gray-900">Pago</h2>
          {selectedPlan && (
            <p className="text-sm text-gray-600">
              Precio mensual base:{" "}
              <span className="font-medium text-gray-900">
                {formatCents(livePrice, selectedPlan.currency, "month")}
              </span>
            </p>
          )}

          {!paymentOptions.cardsEnabled && !paymentOptions.transferEnabled && (
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
                description="Te mostramos CBU/alias para transferir. Queda pendiente de confirmación."
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
              <div>
                <label
                  htmlFor="paymentReference"
                  className="block text-sm text-gray-700"
                >
                  Referencia / comprobante
                </label>
                <input
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  className="ori-input mt-1"
                  placeholder="Ej. número de operación"
                  required
                />
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
              Ya tengo cuenta
            </button>
          </div>

          {authMode === "signup" ? (
            <form action={signUpAction} className="mt-6 space-y-4">
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="planId" value={selectedPlanId} />
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
              </div>
              <SubmitButton
                pending={pending}
                label="Crear cuenta y verificar email"
              />
            </form>
          ) : (
            <form action={signInAction} className="mt-6 space-y-4">
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="planId" value={selectedPlanId} />
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
              <SubmitButton
                pending={pending}
                label="Iniciar sesión y suscribirme"
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
