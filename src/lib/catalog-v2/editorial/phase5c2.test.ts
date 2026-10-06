import { describe, it, expect, vi } from "vitest";
import { publishEditorialCatalog, mapPublishStatus, productsWithoutImage, type PublishDeps } from "./publish";

const bytes = new ArrayBuffer(8);
const deps = (o: Partial<PublishDeps> = {}): PublishDeps => ({
  begin: vi.fn(async () => ({ publication_id: "p1", storage_path: "s/catalogs/editorial/p1.pdf", status: "pending" })),
  upload: vi.fn(async () => {}),
  publish: vi.fn(async () => ({ status: "published", share_code: "abcdefghijk" })),
  ...o,
});

describe("publicação do Editorial", () => {
  it("publica e devolve o código curto existente", async () => {
    const d = deps();
    expect(await publishEditorialCatalog(bytes, "k", null, d)).toEqual({ ok: true, shareCode: "abcdefghijk", replayed: false });
    expect(d.upload).toHaveBeenCalledWith("s/catalogs/editorial/p1.pdf", bytes);
  });
  it("falha no envio não chama a publicação", async () => {
    const d = deps({ upload: vi.fn(async () => { throw new Error("network"); }) });
    const r = await publishEditorialCatalog(bytes, "k", null, d);
    expect(r).toMatchObject({ ok: false, reason: "upload_failed" });
    expect(d.publish).not.toHaveBeenCalled();
  });
  it("nova tentativa com arquivo já enviado segue para a confirmação", async () => {
    const d = deps({ upload: vi.fn(async () => { throw new Error("The resource already exists"); }) });
    expect((await publishEditorialCatalog(bytes, "k", null, d)).ok).toBe(true);
  });
  it("falha na troca do catálogo não informa sucesso", async () => {
    const d = deps({ publish: vi.fn(async () => { throw new Error("timeout"); }) });
    expect(await publishEditorialCatalog(bytes, "k", null, d)).toMatchObject({ ok: false, reason: "failed" });
  });
  it("publicação já concluída com a mesma chave não reenvia o arquivo", async () => {
    const d = deps({ begin: vi.fn(async () => ({ publication_id: "p1", storage_path: "x", status: "published" })), publish: vi.fn(async () => ({ status: "published", share_code: "abcdefghijk", replayed: true })) });
    expect(await publishEditorialCatalog(bytes, "k", null, d)).toMatchObject({ ok: true, replayed: true });
    expect(d.upload).not.toHaveBeenCalled();
  });
  it("loja sem liberação é bloqueada antes do envio", async () => {
    const d = deps({ begin: vi.fn(async () => { throw new Error("editorial not allowed"); }) });
    expect(await publishEditorialCatalog(bytes, "k", null, d)).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(d.upload).not.toHaveBeenCalled();
  });
  it("traduz recusas do servidor", () => {
    expect(mapPublishStatus({ status: "rejected_stale" })).toMatchObject({ reason: "stale" });
    expect(mapPublishStatus({ status: "rejected_missing_file" })).toMatchObject({ reason: "missing_file" });
    expect(mapPublishStatus({ status: "published", share_code: null })).toMatchObject({ reason: "share_failed" });
  });
  it("conta como sem imagem só quem não tem principal nem adicionais", () => {
    const doc = { products: [
      { id: "a", primaryImage: null, additionalImages: [] },
      { id: "b", primaryImage: null, additionalImages: [{ url: "u" }] },
      { id: "c", primaryImage: { url: "u" }, additionalImages: [] },
    ] } as never;
    expect(productsWithoutImage(doc)).toEqual(["a"]);
  });
});
