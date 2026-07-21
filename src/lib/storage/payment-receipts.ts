import "server-only";

import { randomUUID } from "crypto";

import { createDbClient } from "@/lib/db/client";

export const PAYMENT_RECEIPTS_BUCKET = "payment-receipts";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function extensionFor(mime: string, fallbackName: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  const fromName = fallbackName.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "pdf"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "bin";
}

async function ensureBucket(): Promise<void> {
  const db = createDbClient();
  const { data: buckets } = await db.storage.listBuckets();
  if (buckets?.some((b) => b.name === PAYMENT_RECEIPTS_BUCKET)) {
    return;
  }

  const { error } = await db.storage.createBucket(PAYMENT_RECEIPTS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });

  // Race: another request may have created it.
  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error(
      `No se pudo preparar el almacenamiento de comprobantes: ${error.message}`,
    );
  }
}

export async function uploadPaymentReceipt(input: {
  tenantId: string;
  file: File;
}): Promise<{ path: string } | { error: string }> {
  if (input.file.size <= 0) {
    return { error: "El archivo del comprobante está vacío" };
  }
  if (input.file.size > MAX_BYTES) {
    return { error: "El comprobante no puede superar 5 MB" };
  }
  if (!ALLOWED_TYPES.has(input.file.type)) {
    return {
      error: "El comprobante debe ser PDF, JPG, PNG o WEBP",
    };
  }

  try {
    await ensureBucket();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo preparar el almacenamiento",
    };
  }

  const ext = extensionFor(input.file.type, input.file.name);
  const path = `${input.tenantId}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const db = createDbClient();

  const { error } = await db.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .upload(path, bytes, {
      contentType: input.file.type,
      upsert: false,
    });

  if (error) {
    return { error: `No se pudo subir el comprobante: ${error.message}` };
  }

  return { path };
}

export async function getPaymentReceiptSignedUrl(
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const db = createDbClient();
  const { data, error } = await db.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export function receiptFileFromFormData(
  formData: FormData,
  fieldName = "paymentReceipt",
): File | null {
  const value = formData.get(fieldName);
  if (!value || !(value instanceof File) || value.size === 0) {
    return null;
  }
  return value;
}
