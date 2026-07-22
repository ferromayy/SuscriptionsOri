"use client";

import { useEffect, useState } from "react";

import { buildWhatsAppUrl } from "@/lib/subscribers/whatsapp";

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function JoinWhatsAppHelp({
  phone,
  brandName = "Orí",
}: {
  phone: string;
  brandName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ori-join-wa-seen") === "1") return;
      const timer = window.setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem("ori-join-wa-seen", "1");
      }, 1200);
      return () => window.clearTimeout(timer);
    } catch {
      setOpen(true);
    }
  }, []);

  const message =
    `Hola ${brandName}! Me interesa una suscripción. ` +
    `¿Me pueden registrar ustedes por acá o ayudarme con una consulta?`;
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4 sm:p-6">
      <div className="pointer-events-auto flex max-w-[min(100%,20rem)] flex-col items-end gap-3">
        {open && (
          <div className="ori-join-step-enter w-full rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xl shadow-black/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Estamos en WhatsApp
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  Te ayudamos a suscribirte sin llenar el formulario, o
                  respondemos cualquier consulta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-1.5 py-0.5 text-lg leading-none text-gray-400 transition hover:text-gray-700"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f6b4a] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#185a3e]"
            >
              <WhatsAppGlyph className="h-4 w-4" />
              Abrir WhatsApp
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex items-center gap-2 rounded-full bg-[#1f6b4a] py-3 pl-3.5 pr-4 text-sm font-medium text-white shadow-lg shadow-black/20 transition hover:bg-[#185a3e]"
          aria-expanded={open}
          aria-label={
            open ? "Cerrar ayuda de WhatsApp" : "Abrir ayuda de WhatsApp"
          }
        >
          <WhatsAppGlyph className="h-5 w-5" />
          <span className="hidden sm:inline">WhatsApp</span>
        </button>
      </div>
    </div>
  );
}
