"use client";

import { ARGENTINA_PROVINCES } from "@/lib/subscribers/argentina-provinces";

export function ProvinceLocalityFields({
  province,
  locality,
  onProvinceChange,
  onLocalityChange,
  provinceId = "province",
  localityId = "locality",
}: {
  province: string;
  locality: string;
  onProvinceChange: (value: string) => void;
  onLocalityChange: (value: string) => void;
  provinceId?: string;
  localityId?: string;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Provincia y localidad
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Indicá dónde querés recibir el pedido.
        </p>
      </div>

      <div>
        <label htmlFor={provinceId} className="block text-sm text-gray-700">
          Provincia
        </label>
        <select
          id={provinceId}
          value={province}
          onChange={(event) => onProvinceChange(event.target.value)}
          className="ori-input mt-1"
          required
        >
          <option value="">Elegí una provincia</option>
          {province &&
            !(ARGENTINA_PROVINCES as readonly string[]).includes(province) && (
              <option value={province}>{province}</option>
            )}
          {ARGENTINA_PROVINCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={localityId} className="block text-sm text-gray-700">
          Localidad
        </label>
        <input
          id={localityId}
          value={locality}
          onChange={(event) => onLocalityChange(event.target.value)}
          className="ori-input mt-1"
          required
          autoComplete="address-level2"
          placeholder="Ej. Palermo, Córdoba Capital, Rosario"
        />
        <p className="mt-1 text-xs text-gray-500">
          Ciudad o localidad (no hace falta el barrio acá).
        </p>
      </div>
    </div>
  );
}
