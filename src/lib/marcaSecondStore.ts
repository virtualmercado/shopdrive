import { z } from "zod";

/** Same field rules as the official store sign-up (Register), without the password: the new owner defines it by e-mail. */
export const secondStoreSchema = z.object({
  ownerName: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  storeName: z.string().trim().min(3, "Nome da loja deve ter no mínimo 3 caracteres").max(100),
});
export type SecondStoreInput = z.infer<typeof secondStoreSchema>;

export interface MarcaStoreSlots { eligible: boolean; used: number; limit: number; canCreate: boolean; pending: boolean }

export const MARCA_LIMIT_MESSAGE = "Limite de 2 lojas do Plano MARCA atingido.";

export function parseSlots(value: unknown): MarcaStoreSlots {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const used = typeof row.used === "number" ? row.used : 0;
  const limit = typeof row.limit === "number" ? row.limit : 2;
  return { eligible: row.eligible === true, used, limit, canCreate: row.eligible === true && row.canCreate === true && used < limit, pending: row.pending === true };
}

/** What the "Minhas Lojas" creation area shows. Only "create" may open the form. */
export function slotView(slots: MarcaStoreSlots | null): "hidden" | "create" | "limit" | "pending" {
  if (!slots || !slots.eligible) return "hidden";
  if (!slots.canCreate) return "limit";
  if (slots.pending) return "pending";
  return "create";
}

export type CreationOutcome =
  | { kind: "completed"; storeId: string; accessEmailSent: boolean }
  | { kind: "in_progress" }
  | { kind: "limit_reached" }
  | { kind: "error"; message: string; rotateKey: boolean };

export function resolveCreationResponse(body: unknown): CreationOutcome {
  const row = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  switch (row.status) {
    case "completed":
      return typeof row.storeId === "string"
        ? { kind: "completed", storeId: row.storeId, accessEmailSent: row.accessEmailSent !== false }
        : { kind: "error", message: "Não foi possível confirmar a criação da loja.", rotateKey: false };
    case "in_progress": return { kind: "in_progress" };
    case "limit_reached": return { kind: "limit_reached" };
    case "email_unavailable": return { kind: "error", message: "Este e-mail já está cadastrado na plataforma. Use um e-mail diferente para a nova loja.", rotateKey: true };
    case "invalid_input": return { kind: "error", message: "Confira os dados informados.", rotateKey: true };
    case "ineligible": return { kind: "error", message: "Sua conta não pode criar lojas do Plano MARCA.", rotateKey: true };
    case "failed": return { kind: "error", message: "Não foi possível criar a loja. Tente novamente.", rotateKey: true };
    default: return { kind: "error", message: "Não foi possível criar a loja. Tente novamente.", rotateKey: false };
  }
}
