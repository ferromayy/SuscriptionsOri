import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Subscriptions Ori",
  description: "Plataforma de suscripciones multi-tenant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceMono.variable} h-full`}
    >
      <body className="ori-shell min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
