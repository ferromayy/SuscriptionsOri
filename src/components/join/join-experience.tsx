"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";

import {
  JoinForm,
  type JoinPaymentOptions,
} from "@/components/join/join-form";
import { JoinWhatsAppHelp } from "@/components/join/join-whatsapp-help";
import type { PublicPlan } from "@/lib/plans/get-plans";

const JOIN_BENEFITS = [
  {
    title: "Café recién tostado",
    body: "Cada envío sale fresco, listo para moler y disfrutar en casa.",
  },
  {
    title: "Precio preferencial",
    body: "Condiciones pensadas para quienes eligen formar parte.",
  },
  {
    title: "A tu ritmo",
    body: "Elegís frecuencia, cantidad y cómo querés recibirlo.",
  },
  {
    title: "Siempre listo",
    body: "Una buena taza esperándote, sin tener que acordarte de pedir.",
  },
] as const;

const JOIN_STEPS = [
  {
    number: "01",
    title: "Elegí tu experiencia",
    body: "Mirás las opciones del comercio y elegís la que mejor va con vos.",
  },
  {
    number: "02",
    title: "Completá tus datos",
    body: "Contacto, entrega y pago en unos pocos pasos claros.",
  },
  {
    number: "03",
    title: "Recibí tu café",
    body: "Nosotros preparamos el envío y vos disfrutás en casa o en la oficina.",
  },
] as const;

export function JoinExperience({
  tenantSlug,
  tenantName,
  plans,
  paymentOptions,
  supportWhatsapp,
}: {
  tenantSlug: string;
  tenantName: string;
  plans: PublicPlan[];
  paymentOptions: JoinPaymentOptions;
  supportWhatsapp: string | null;
}) {
  const [inCheckout, setInCheckout] = useState(false);

  return (
    <>
      <section
        className={`relative isolate overflow-hidden transition-[min-height] duration-300 ${
          inCheckout ? "min-h-[11rem] sm:min-h-[12rem]" : "min-h-[68vh] sm:min-h-[72vh]"
        }`}
      >
        <Image
          src="/images/join/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_28%] sm:object-[68%_26%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25"
          aria-hidden
        />

        <div
          className={`ori-container relative z-10 flex h-full flex-col justify-end ${
            inCheckout ? "py-8 sm:py-10" : "pb-14 pt-24 sm:pb-16 sm:pt-28"
          }`}
        >
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-white/75">
            Orí
          </p>
          <h1
            className={
              inCheckout
                ? "mt-2 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl"
                : "mt-4 max-w-xl text-5xl font-bold tracking-tight text-white sm:text-6xl"
            }
          >
            Suscripciones
          </h1>
          {inCheckout ? (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
              Completá los datos para activar tu suscripción.
            </p>
          ) : (
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
              Nunca te quedes sin café fresco. Primero te posicionás en el plan
              que más te representa; después arrancamos juntos la experiencia.
            </p>
          )}
        </div>
      </section>

      <div className="ori-container py-10 sm:py-14">
        <section className={inCheckout ? "mt-0" : "mt-2"}>
          <JoinForm
            tenantSlug={tenantSlug}
            plans={plans}
            paymentOptions={paymentOptions}
            layout="marketing"
            onCheckoutActiveChange={setInCheckout}
          />
        </section>

        {supportWhatsapp && (
          <JoinWhatsAppHelp
            phone={supportWhatsapp}
            brandName={tenantName}
          />
        )}

        {!inCheckout && (
          <>
            <section className="mt-20 border-t border-gray-200/80 pt-14 sm:mt-24 sm:pt-16">
              <p className="ori-section-label">Incluye</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                Beneficios de formar parte
              </h2>
              <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {JOIN_BENEFITS.map((benefit) => (
                  <li key={benefit.title}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-900">
                      {benefit.title}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">
                      {benefit.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-16 border-t border-gray-200/80 pt-14 sm:mt-20 sm:pt-16">
              <p className="ori-section-label">Cómo funciona</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                Tres pasos
              </h2>
              <ol className="mt-10 grid gap-10 sm:grid-cols-3">
                {JOIN_STEPS.map((item) => (
                  <li key={item.number}>
                    <p className="text-xs font-medium tracking-[0.16em] text-gray-400">
                      {item.number}
                    </p>
                    <p className="mt-3 text-base font-semibold text-gray-900">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <p
          className={`pb-4 text-center text-sm text-gray-500 ${
            inCheckout ? "mt-10" : "mt-16 sm:mt-20"
          }`}
        >
          ¿Ya tenés cuenta?{" "}
          <Link
            href={`/auth/login?next=/app/${tenantSlug}/join`}
            className="font-medium text-gray-800 underline-offset-4 hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </>
  );
}
