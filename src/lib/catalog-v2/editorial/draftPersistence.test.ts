import { describe, it, expect, vi } from "vitest";
import { buildDraftDocument, draftConfigKey, draftEditorialInput, parseDraftConfig, DRAFT_SAVE_DEBOUNCE_MS } from "./draftConfig";
import { createDraftSaveQueue } from "./draftSaveQueue";
import { fixtureStoreB } from "./editorialFixtures";
import { flushCatalogBeforeLeave, registerCatalogSaveGuard } from "./navigationSave";

describe("persistent Editorial draft rules", () => {
  it("retains every inactive branch and permanent image reference through serialization", () => {
    const c = parseDraftConfig({ title: "Loja teste", coverMode: "custom", coverImage: "https://example.test/store/catalog-covers/cover.jpg", backImage: "https://example.test/store/catalog-backcovers/back.png", instImage: "https://example.test/store/catalog-institutional/about.webp", sectionImages: { section: "https://example.test/store/catalog-sections/a.jpg" }, categoryIds: ["category"], productIds: ["p"], instEnabled: false, instText: "preserved", comEnabled: false, com: { payment: "PIX" }, featEnabled: false, featured: ["p"], typography: { title: { fontFamily: "lato", fontWeight: 700, color: "#135790" } } }, 1);
    expect(parseDraftConfig(JSON.parse(JSON.stringify(c)), 1)).toEqual(c);
    expect(c.instText).toBe("preserved"); expect(c.com.payment).toBe("PIX"); expect(c.productIds).toEqual(["p"]);
  });
  it("rejects unknown draft versions without resetting saved intent", () => {
    expect(() => parseDraftConfig({ title: "kept" }, 2)).toThrow("unsupported");
  });
  it("uses a 1000ms debounce within the requested 800–1500ms interval", () => {
    expect(DRAFT_SAVE_DEBOUNCE_MS).toBe(1000);
  });
  it("compares keys independent of PostgreSQL jsonb ordering", () => {
    expect(draftConfigKey({ title: "A", com: { intro: "I", title: "C" } })).toBe(draftConfigKey({ com: { title: "C", intro: "I" }, title: "A" }));
    expect(draftConfigKey({ title: "A" })).not.toBe(draftConfigKey({ title: "B" }));
  });
  it("all mode uses current active data, including new products and changed prices", () => {
    const source = fixtureStoreB(5);
    source.products[0].price = 321.45; source.products[0].promotional_price = null;
    source.products[1].is_active = false;
    const doc = buildDraftDocument(source, parseDraftConfig({}, 1));
    expect(doc?.products).toHaveLength(4);
    expect(doc?.products.find((p) => p.id.endsWith("p000"))?.price.effective.amount).toBe(321.45);
    expect(doc?.products.some((p) => p.id.endsWith("p004"))).toBe(true);
    expect(doc?.products.some((p) => p.id.endsWith("p001"))).toBe(false);
  });
  it("manual mode retains intent but excludes deleted, paused and new IDs", () => {
    const source = fixtureStoreB(4); source.products[1].is_active = false;
    const c = parseDraftConfig({ mode: "products", productIds: [source.products[0].id, source.products[1].id, "deleted"] }, 1);
    expect(buildDraftDocument(source, c)?.products.map((p) => p.id)).toEqual([source.products[0].id]);
    expect(c.productIds).toHaveLength(3);
    expect(buildDraftDocument(source, { ...c, productIds: ["deleted"] })).toBeNull();
  });
  it("filters foreign IDs and unavailable categories without selecting everything", () => {
    const s = fixtureStoreB();
    expect(buildDraftDocument(s, parseDraftConfig({ mode: "categories", categoryIds: ["foreign"] }, 1))).toBeNull();
    expect(buildDraftDocument(s, parseDraftConfig({ mode: "brands", brandIds: ["__sem_marca__"] }, 1))?.products).toHaveLength(4);
  });
  it("excludes no-image products locally and preserves inactive featured intent", () => {
    const s = fixtureStoreB(); s.products[0].image_url = null;
    const c = parseDraftConfig({ excludeNoImage: true, featEnabled: true, featured: [s.products[0].id, s.products[1].id, "deleted"] }, 1);
    const doc = buildDraftDocument(s, c);
    expect(doc?.products).toHaveLength(3);
    if (!doc) throw new Error("missing document");
    expect(draftEditorialInput(doc, c).featured?.productIds).toEqual([s.products[1].id]);
    expect(c.featured).toHaveLength(3); expect(s.products).toHaveLength(4);
  });
});

describe("revision-checked serial saving", () => {
  it("does not save loaded defaults over an existing draft", async () => {
    const save = vi.fn(async () => ({ draft_revision: 8 }));
    const q = createDraftSaveQueue({ initial: { title: "saved" }, revision: 7, save, onStatus: vi.fn() });
    expect(await q.flush()).toBe(true); expect(save).not.toHaveBeenCalled();
  });
  it("persists first-time defaults only when no draft exists", async () => {
    const save = vi.fn(async () => ({ draft_revision: 1 }));
    const q = createDraftSaveQueue({ initial: { title: "default" }, revision: 0, needsInitialSave: true, save, onStatus: vi.fn() });
    expect(await q.flush()).toBe(true); expect(save).toHaveBeenCalledWith({ title: "default" }, 0);
  });
  it("drains newer edits during a deferred request before reporting saved", async () => {
    let resolveFirst: ((value: { draft_revision: number }) => void) | undefined;
    const statuses: string[] = [];
    const save = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; })).mockResolvedValueOnce({ draft_revision: 2 });
    const q = createDraftSaveQueue({ initial: { title: "A" }, revision: 0, save, onStatus: (s) => statuses.push(s) });
    q.update({ title: "B" }); const pending = q.flush();
    expect(statuses).not.toContain("saved");
    q.update({ title: "C" }); const concurrent = q.flush();
    resolveFirst?.({ draft_revision: 1 });
    expect(await pending).toBe(true); expect(await concurrent).toBe(true);
    expect(save.mock.calls).toEqual([[{ title: "B" }, 0], [{ title: "C" }, 1]]);
    expect(q.dirty()).toBe(false); expect(statuses.at(-1)).toBe("saved");
  });
  it("keeps a failed edit dirty and allows retry without acknowledging false success", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ draft_revision: 1 });
    const statuses: string[] = [];
    const q = createDraftSaveQueue({ initial: "A", revision: 0, save, onStatus: (s) => statuses.push(s) });
    q.update("B"); expect(await q.flush()).toBe(false); expect(q.dirty()).toBe(true); expect(statuses).not.toContain("saved");
    expect(await q.flush()).toBe(true); expect(q.dirty()).toBe(false);
  });
  it("a concurrent-tab conflict preserves local values and never overwrites the new revision", async () => {
    const save = vi.fn().mockRejectedValue({ message: "catalog draft conflict", code: "40001" });
    const q = createDraftSaveQueue({ initial: "A", revision: 4, save, onStatus: vi.fn() });
    q.update("B"); expect(await q.flush()).toBe(false); expect(await q.flush()).toBe(false);
    expect(q.getCurrent()).toBe("B"); expect(q.getRevision()).toBe(4); expect(save).toHaveBeenCalledTimes(1);
  });
  it("logout/navigation guard waits for save and blocks departure on failure", async () => {
    const remove = registerCatalogSaveGuard(async () => false);
    expect(await flushCatalogBeforeLeave()).toBe(false); remove();
    expect(await flushCatalogBeforeLeave()).toBe(true);
  });
});