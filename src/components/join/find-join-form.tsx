"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FindJoinForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!clean) {
          setError("Ingresá el nombre de la organización");
          return;
        }
        setError(null);
        router.push(`/app/${clean}/join`);
      }}
    >
      <div>
        <label htmlFor="tenantSlug" className="block text-sm text-gray-700">
          Código de la organización
        </label>
        <input
          id="tenantSlug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ej: maria"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
        />
        <p className="mt-1 text-xs text-gray-500">
          Es el slug que te dio quien te invitó (aparece en el link).
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white"
      >
        Ir a registrarme
      </button>
    </form>
  );
}
