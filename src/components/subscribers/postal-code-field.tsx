"use client";

import {
  ARGENTINE_POSTAL_CODE_GUIDE,
  ARGENTINE_POSTAL_CODE_HINT,
  isValidArgentinePostalCode,
  maskArgentinePostalCodeInput,
} from "@/lib/subscribers/argentine-postal-code";

export function PostalCodeField({
  label = "Código postal",
  value,
  onChange,
  required = true,
  id,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
}) {
  const fieldId = id ?? "postal-code";
  const showError = value.trim().length > 0 && !isValidArgentinePostalCode(value);

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm text-gray-700">
        {label}
      </label>
      <input
        id={fieldId}
        value={value}
        onChange={(event) =>
          onChange(maskArgentinePostalCodeInput(event.target.value))
        }
        className="ori-input mt-1 uppercase"
        required={required}
        inputMode="text"
        autoComplete="postal-code"
        placeholder="1425 o C1425ABC"
        maxLength={8}
        spellCheck={false}
        aria-invalid={showError}
        aria-describedby={`${fieldId}-hint`}
      />
      <div
        id={`${fieldId}-hint`}
        className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
      >
        <p className="text-xs text-gray-600">{ARGENTINE_POSTAL_CODE_HINT}</p>
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
          {ARGENTINE_POSTAL_CODE_GUIDE.map((item) => (
            <li key={item.label}>
              <span className="text-gray-500">{item.label}:</span>{" "}
              <span className="font-mono font-semibold tracking-wide">
                {item.example}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {showError && (
        <p className="mt-1 text-xs text-red-600">
          Revisá el formato: 4 dígitos o letra + 4 dígitos + 3 letras.
        </p>
      )}
    </div>
  );
}
