/**
 * Pré-visualização a partir dos BYTES do PDF gerado (pdf.js).
 * Não existe desenho paralelo em HTML: o que aparece é o próprio documento.
 * Uso isolado para homologação; não está ligado a nenhuma tela.
 */
export async function renderPdfPreview(bytes: ArrayBuffer, opts: { scale?: number; pages?: number[] } = {}): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false }).promise;
  const wanted = opts.pages ?? Array.from({ length: pdf.numPages }, (_, i) => i + 1);
  const canvases: HTMLCanvasElement[] = [];
  for (const n of wanted) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: opts.scale ?? 1.25 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    canvases.push(canvas);
    page.cleanup();
  }
  await pdf.destroy();
  return canvases;
}
