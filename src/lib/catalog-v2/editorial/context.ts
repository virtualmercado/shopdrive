import type { CatalogImage } from "@/lib/catalogPdfClassic";
import type { CatalogDocument, CatalogImageRef, CatalogProduct } from "../types";
import type { EditorialTheme } from "./theme";

export interface RenderContext {
  doc: CatalogDocument;
  theme: EditorialTheme;
  title: string;
  subtitle: string | null;
  showPrices: boolean;
  product: (id: string) => CatalogProduct;
  categoryName: (id: string | null) => string | null;
  brandName: (id: string | null) => string | null;
  /** Imagem já resolvida para a página atual (ou null). */
  image: (ref: CatalogImageRef | null | undefined) => CatalogImage | null;
  logo: CatalogImage | null;
  totalPages: number;
}
