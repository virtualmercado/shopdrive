import { createCatalogImageLoader, fitWithinEdge, type CatalogImage } from "@/lib/catalogPdfClassic";
import type { ImageResolver } from "./generateEditorialPdf";

/** Decodifica no navegador já reduzida ao tamanho de uso; nunca altera o original. */
const decodeInBrowser = (url: string, preserve: boolean, maxEdge: number, timeoutMs: number): Promise<Omit<CatalogImage, "alias"> | null> =>
  new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: Omit<CatalogImage, "alias"> | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => { img.src = ""; finish(null); }, timeoutMs);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const { width, height } = fitWithinEdge(img.naturalWidth, img.naturalHeight, maxEdge);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const c = canvas.getContext("2d");
        if (!c) return finish(null);
        if (!preserve) { c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, width, height); }
        c.imageSmoothingQuality = "high";
        c.drawImage(img, 0, 0, width, height);
        const data = canvas.toDataURL(preserve ? "image/png" : "image/jpeg", 0.82);
        canvas.width = canvas.height = 0; // libera o bitmap imediatamente
        finish({ data, width, height, format: preserve ? "PNG" : "JPEG" });
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = url;
  });

/** Um resolver por geração (cache por URL/tamanho, timeout de 15 s, falha = null). */
export const createBrowserImageResolver = (): ImageResolver => {
  const loader = createCatalogImageLoader(decodeInBrowser);
  return (url, maxEdge, preserve) => loader.load(url, preserve, maxEdge);
};
