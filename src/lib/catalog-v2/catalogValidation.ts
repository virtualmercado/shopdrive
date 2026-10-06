import { CATALOG_PUBLIC_ORIGIN } from "@/lib/catalogPdfClassic";
import { CATALOG_SCHEMA_VERSION, type CatalogDocument } from "./types";

/** Retorna a lista de problemas; vazia = documento válido. */
export const validateCatalogDocument = (doc: CatalogDocument): string[] => {
  const errors: string[] = [];
  if (doc.schemaVersion !== CATALOG_SCHEMA_VERSION) errors.push("schemaVersion inválida");
  if (!doc.storeId) errors.push("storeId ausente");
  const ids = new Set<string>();
  doc.products.forEach((p) => {
    if (ids.has(p.id)) errors.push(`produto duplicado: ${p.id}`);
    ids.add(p.id);
    if (!p.isActive) errors.push(`produto inativo: ${p.id}`);
    if (!Number.isFinite(p.price.effective.amount)) errors.push(`preço inválido: ${p.id}`);
    if (p.publicUrl && !p.publicUrl.startsWith(`${CATALOG_PUBLIC_ORIGIN}/`)) errors.push(`URL fora do domínio público: ${p.id}`);
  });
  doc.sections.forEach((s) => s.productIds.forEach((id) => { if (!ids.has(id)) errors.push(`seção ${s.id} referencia produto ausente ${id}`); }));
  try {
    const round = JSON.parse(JSON.stringify(doc));
    if (round.products.length !== doc.products.length) errors.push("documento não serializável");
  } catch {
    errors.push("documento não serializável");
  }
  return errors;
};
