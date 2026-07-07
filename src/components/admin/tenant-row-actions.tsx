"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteTenant,
  regenerateInvitation,
} from "@/app/admin/actions";

export function TenantRowActions({
  tenantId,
  tenantName,
  status,
  hasPendingInvite,
}: {
  tenantId: string;
  tenantName: string;
  status: string;
  hasPendingInvite: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"delete" | "regen" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {hasPendingInvite && status === "pending_owner" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={async () => {
            setLoading("regen");
            setMessage(null);
            const result = await regenerateInvitation(tenantId);
            setLoading(null);
            if (result.error) {
              setMessage(result.error);
            } else if (result.inviteUrl) {
              setNewInviteUrl(result.inviteUrl);
              setNewInviteCode(result.inviteCode ?? null);
              setMessage("Nuevo link y código generados — copialos abajo");
              router.refresh();
            }
          }}
          className="text-xs text-sky-400 hover:text-blue-700 disabled:opacity-50"
        >
          {loading === "regen" ? "Generando..." : "Nuevo link y código"}
        </button>
      )}

      <button
        type="button"
        disabled={loading !== null}
        onClick={async () => {
          if (
            !confirm(
              `¿Eliminar "${tenantName}"? Se borran invitaciones y datos asociados.`,
            )
          ) {
            return;
          }
          setLoading("delete");
          setMessage(null);
          const result = await deleteTenant(tenantId);
          setLoading(null);
          if (result.error) {
            setMessage(result.error);
          } else {
            router.refresh();
          }
        }}
        className="block text-xs text-red-600 hover:text-red-300 disabled:opacity-50"
      >
        {loading === "delete" ? "Eliminando..." : "Eliminar"}
      </button>

      {newInviteCode && (
        <p className="text-sm font-bold tracking-widest text-gray-700">
          Código: {newInviteCode}
        </p>
      )}

      {newInviteUrl && (
        <input
          readOnly
          value={newInviteUrl}
          onFocus={(e) => e.target.select()}
          className="mt-1 w-full max-w-xs rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
        />
      )}

      {message && (
        <p className="text-xs text-gray-500">{message}</p>
      )}
    </div>
  );
}
