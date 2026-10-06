import { readFileSync, writeFileSync } from "fs";
import { buildCatalogDocument } from "../catalogDocument";
import { generateEditorialPdf } from "./generateEditorialPdf";
import { fixtureStoreA, fixtureStoreB } from "./editorialFixtures";

const sizes = [[900, 1200], [1200, 900], [1000, 1000]];
const resolve = async (url: string) => {
  const f = url.replace("fixture://", "");
  const buf = readFileSync(`/tmp/demo/img/${f}`);
  const png = f.endsWith(".png");
  const i = Number(f.match(/p(\d+)/)?.[1] ?? 0);
  const [width, height] = png ? [600, 300] : sizes[i % 3];
  return { data: `data:image/${png ? "png" : "jpeg"};base64,${buf.toString("base64")}`, width, height, format: (png ? "PNG" : "JPEG") as "PNG" | "JPEG", alias: f };
};

const a = buildCatalogDocument(fixtureStoreA(), { presentation: { grouping: "category" } });
const ra = await generateEditorialPdf(a, { resolveImage: resolve, title: "Coleção Primavera 2026", subtitle: "Cuidados naturais para corpo e casa" });
writeFileSync("/tmp/demo/editorial_A.pdf", Buffer.from(ra.bytes));
console.log("A", ra.plan.map((p) => p.kind === "products" ? `P${p.layout}` : p.kind).join(" "));
const b = buildCatalogDocument(fixtureStoreB(4), {});
const rb = await generateEditorialPdf(b, { resolveImage: resolve, title: "Catálogo Outono" });
writeFileSync("/tmp/demo/editorial_B.pdf", Buffer.from(rb.bytes));
console.log("B", rb.plan.map((p) => p.kind === "products" ? `P${p.layout}` : p.kind).join(" "));
