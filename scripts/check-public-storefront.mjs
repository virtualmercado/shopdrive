/**
 * Regression check: anonymous visitors must be able to resolve a public
 * storefront, while the private profiles table stays unreadable for them.
 *
 * This exact bug shipped twice (fixed 2026-06-19, reintroduced 2026-09-15),
 * so run this after any change to public views, RLS or grants:
 *
 *   node scripts/check-public-storefront.mjs [store-slug]
 */
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
  } catch {
    /* .env is optional */
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const anon = (path) =>
  fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const slugArg = process.argv[2];

// Pick a real public store when no slug is provided.
const listRes = await anon("public_store_profiles?select=store_slug,store_name&limit=2");
const list = listRes.ok ? await listRes.json() : [];
check("anon can list public storefronts", Array.isArray(list) && list.length > 0, `status ${listRes.status}`);

const slugA = slugArg || list[0]?.store_slug;
const slugB = list[1]?.store_slug;

if (slugA) {
  const res = await anon(`public_store_profiles?store_slug=eq.${encodeURIComponent(slugA)}&select=id,store_name,store_slug`);
  const rows = res.ok ? await res.json() : [];
  check(`anon + valid slug (${slugA}) resolves the store`, rows.length === 1 && rows[0].store_slug === slugA);
  if (slugB) {
    check("store A slug never returns store B", rows.every((r) => r.store_slug !== slugB));
  }
}

const missing = await anon("public_store_profiles?store_slug=eq.__slug-que-nao-existe__&select=id");
const missingRows = missing.ok ? await missing.json() : null;
check("anon + invalid slug returns nothing", Array.isArray(missingRows) && missingRows.length === 0);

const priv = await anon("profiles?select=id,email&limit=1");
const privRows = priv.ok ? await priv.json() : null;
check(
  "anon cannot read the private profiles table",
  !priv.ok || (Array.isArray(privRows) && privRows.length === 0),
  `status ${priv.status}`
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll public storefront checks passed.");
