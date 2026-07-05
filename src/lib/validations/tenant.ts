import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRegex, "Slug inválido: solo minúsculas, números y guiones"),
  ownerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email inválido"),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
