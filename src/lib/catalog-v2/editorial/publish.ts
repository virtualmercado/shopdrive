import type { CatalogDocument } from "../types";

/**
 * Publicação do Editorial (Fase 5C.2). O servidor é a autoridade: define o caminho,
 * confere permissão, existência do arquivo e se o catálogo atual mudou desde a prévia.
 * Aqui só orquestramos as etapas e traduzimos os resultados.
 */

export type PublishStep = "uploading" | "publishing" | "sharing";

export type PublishOutcome =
  | { ok: true; shareCode: string; replayed: boolean }
  | { ok: false; reason: "stale" | "missing_file" | "unauthorized" | "upload_failed" | "share_failed" | "failed"; message: string };

export interface PublishDeps {
  begin: (key: string, expectedUpdatedAt: string | null) => Promise<{ publication_id: string; storage_path: string; status: string }>;
  upload: (path: string, bytes: ArrayBuffer) => Promise<void>;
  publish: (publicationId: string) => Promise<{ status: string; share_code?: string | null; replayed?: boolean }>;
}

export const PUBLISH_MESSAGES = {
  stale: "O catálogo da loja foi alterado por outra publicação depois da sua prévia. Nada foi substituído. Gere a prévia novamente para publicar.",
  missing_file: "O arquivo enviado não foi encontrado. Nada foi substituído. Tente publicar novamente.",
  unauthorized: "O Catálogo Editorial não está liberado para esta loja. Nada foi substituído.",
  upload_failed: "Não foi possível enviar o arquivo. O catálogo atual continua o mesmo. Tente novamente.",
  share_failed: "O catálogo foi publicado, mas o link de compartilhamento não pôde ser confirmado. Tente copiar o link novamente.",
  failed: "Não foi possível publicar. O catálogo atual continua o mesmo. Tente novamente.",
} as const;

const fail = (reason: Exclude<PublishOutcome, { ok: true }>["reason"]): PublishOutcome => ({ ok: false, reason, message: PUBLISH_MESSAGES[reason] });

export const mapPublishStatus = (r: { status: string; share_code?: string | null; replayed?: boolean }): PublishOutcome => {
  if (r.status === "published") {
    return r.share_code ? { ok: true, shareCode: r.share_code, replayed: !!r.replayed } : fail("share_failed");
  }
  if (r.status === "rejected_stale") return fail("stale");
  if (r.status === "rejected_missing_file") return fail("missing_file");
  if (r.status === "rejected_unauthorized") return fail("unauthorized");
  return fail("failed");
};

/**
 * Mesma chave em toda nova tentativa (clique duplo, timeout) = uma única publicação.
 * Upload nunca sobrescreve: o caminho é único por publicação.
 */
export async function publishEditorialCatalog(
  bytes: ArrayBuffer,
  idempotencyKey: string,
  expectedUpdatedAt: string | null,
  deps: PublishDeps,
  onStep?: (s: PublishStep) => void,
): Promise<PublishOutcome> {
  let pub;
  try {
    pub = await deps.begin(idempotencyKey, expectedUpdatedAt);
  } catch (e) {
    return /not allowed/i.test(String((e as Error)?.message ?? e)) ? fail("unauthorized") : fail("failed");
  }
  if (pub.status !== "pending") {
    // Repetição de uma publicação já concluída/recusada: o servidor responde o resultado.
    try { return mapPublishStatus(await deps.publish(pub.publication_id)); } catch { return fail("failed"); }
  }
  onStep?.("uploading");
  try {
    await deps.upload(pub.storage_path, bytes);
  } catch (e) {
    // Arquivo já enviado numa tentativa anterior com a mesma chave: segue para a confirmação.
    if (!/exists|duplicate/i.test(String((e as Error)?.message ?? e))) return fail("upload_failed");
  }
  onStep?.("publishing");
  try {
    const r = await deps.publish(pub.publication_id);
    onStep?.("sharing");
    return mapPublishStatus(r);
  } catch {
    return fail("failed");
  }
}

/** Produto sem imagem cadastrada (principal e adicionais). Falha de carregamento não conta aqui. */
export const productsWithoutImage = (doc: CatalogDocument): string[] =>
  doc.products.filter((p) => !p.primaryImage && p.additionalImages.length === 0).map((p) => p.id);
