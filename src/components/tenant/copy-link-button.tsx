"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-400 hover:bg-gray-100"
    >
      {copied ? "Copiado" : "Copiar link"}
    </button>
  );
}
