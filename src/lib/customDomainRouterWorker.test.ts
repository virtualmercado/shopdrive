import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Global custom-domain ingress Worker (cloudflare/workers/shopdrive-custom-domain-router.js).
// Every network call is mocked: no Cloudflare API, no hosted backend, no real store data.

const SRC = readFileSync("cloudflare/workers/shopdrive-custom-domain-router.js", "utf8");
const AROMA = "www.redearoma.com.br";
const FICTICIOUS = "www.loja-ficticia-a.example.com";
const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";

type Call = { url: string; init?: RequestInit; request?: Request };
let worker: { fetch: (r: Request) => Promise<Response> };
let calls: Call[];
let active: Record<string, string>;
let resolverDown: boolean;
let upstream: (url: string, init?: RequestInit) => Response;

beforeEach(async () => {
  vi.resetModules();
  worker = (await import("../../cloudflare/workers/shopdrive-custom-domain-router.js")).default;
  calls = [];
  active = { [AROMA]: STORE_A, [FICTICIOUS]: STORE_B };
  resolverDown = false;
  upstream = () => new Response("<html>loja</html>", { status: 200, headers: { "content-type": "text/html", "set-cookie": "sid=1" } });
  vi.stubGlobal("fetch", vi.fn(async (input: Request | string, init?: RequestInit) => {
    if (input instanceof Request) { calls.push({ url: input.url, request: input }); return new Response("origin-passthrough"); }
    calls.push({ url: input, init });
    if (input.includes("/rest/v1/rpc/resolve_public_store_by_domain")) {
      if (resolverDown) throw new Error("timeout");
      const h = JSON.parse(String(init!.body)).p_hostname as string;
      return Response.json(active[h] ? [{ store_id: active[h], store_slug: "slug" }] : []);
    }
    return upstream(input, init);
  }));
});
afterEach(() => vi.unstubAllGlobals());

const resolverCalls = () => calls.filter((c) => c.url.includes("/rpc/resolve_public_store_by_domain"));
const upstreamCalls = () => calls.filter((c) => c.url.startsWith("https://shopdrive.com.br/"));

describe("pilot hard-code removed", () => {
  it("source has no AROMA hostname or PILOT_HOSTNAME", () => {
    expect(SRC).not.toMatch(/PILOT_HOSTNAME/);
    expect(SRC).not.toMatch(/redearoma/i);
  });
  it("source carries no secret-like credential (only the public publishable key)", () => {
    expect(SRC).not.toMatch(/service_role|CLOUDFLARE_|sb_secret_|password/i);
    const jwt = SRC.match(/RESOLVER_PUBLISHABLE_KEY = "([^"]+)"/)![1];
    expect(JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).role).toBe("anon");
  });
});

describe("A — www.redearoma.com.br is authorized like any other active hostname", () => {
  it("resolves through the backend and proxies to the fixed upstream", async () => {
    const r = await worker.fetch(new Request(`https://${AROMA}/produto/x?ref=1`));
    expect(r.status).toBe(200);
    expect(JSON.parse(String(resolverCalls()[0].init!.body))).toEqual({ p_hostname: AROMA });
    expect(upstreamCalls()[0].url).toBe("https://shopdrive.com.br/produto/x?ref=1");
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("resolver call only uses options supported by the Workers runtime", async () => {
    await worker.fetch(new Request(`https://${AROMA}/`));
    const init = resolverCalls()[0].init!;
    expect(init.method).toBe("POST");
    expect(["follow", "manual"]).toContain(init.redirect);
  });
  it("normalizes case and trailing dot before resolving", async () => {
    await worker.fetch(new Request("https://WWW.RedeAroma.com.br./"));
    expect(JSON.parse(String(resolverCalls()[0].init!.body)).p_hostname).toBe(AROMA);
  });
  it("caches the decision so assets do not hit the resolver on every request", async () => {
    await worker.fetch(new Request(`https://${AROMA}/`));
    await worker.fetch(new Request(`https://${AROMA}/assets/app.js`));
    expect(resolverCalls()).toHaveLength(1);
    expect(upstreamCalls()).toHaveLength(2);
  });
});

describe("B — unknown / not active hostname fails closed", () => {
  it("returns 421 and never reaches the upstream (no default store, no AROMA fallback)", async () => {
    const r = await worker.fetch(new Request("https://www.desconhecido-exemplo.com/?store=aromadaamazoniarevenda"));
    expect(r.status).toBe(421);
    expect(upstreamCalls()).toHaveLength(0);
  });
  it("apex of a www-only pilot is not authorized", async () => {
    expect((await worker.fetch(new Request("https://redearoma.com.br/"))).status).toBe(421);
  });
  it("ambiguous resolver answers (0 or 2 rows) are denied", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      calls.push({ url: String(u) });
      return Response.json([{ store_id: STORE_A }, { store_id: STORE_B }]);
    }));
    expect((await worker.fetch(new Request("https://www.duas-lojas.example.com/"))).status).toBe(421);
  });
  it("resolver outage without a recent positive decision returns 503, never opens a store", async () => {
    resolverDown = true;
    const r = await worker.fetch(new Request(`https://${FICTICIOUS}/`));
    expect(r.status).toBe(503);
    expect(upstreamCalls()).toHaveLength(0);
  });
  it("revocation takes effect once the short cache expires", async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    try {
      expect((await worker.fetch(new Request(`https://${FICTICIOUS}/`))).status).toBe(200);
      delete active[FICTICIOUS];
      vi.setSystemTime(Date.now() + 61_000);
      expect((await worker.fetch(new Request(`https://${FICTICIOUS}/`))).status).toBe(421);
    } finally { vi.useRealTimers(); }
  });
  it("a hostname confirmed active moments ago survives a short resolver outage", async () => {
    expect((await worker.fetch(new Request(`https://${FICTICIOUS}/`))).status).toBe(200);
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    try {
      resolverDown = true;
      vi.setSystemTime(Date.now() + 120_000);
      expect((await worker.fetch(new Request(`https://${FICTICIOUS}/`))).status).toBe(200);
      vi.setSystemTime(Date.now() + 300_000);
      expect((await worker.fetch(new Request(`https://${FICTICIOUS}/`))).status).toBe(503);
    } finally { vi.useRealTimers(); }
  });
  it("invalid hostname (IP literal) is rejected before any lookup", async () => {
    expect((await worker.fetch(new Request("https://203.0.113.7/"))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("C/D/E — internal ShopDrive hostnames bypass untouched", () => {
  it.each(["shopdrive.com.br", "www.shopdrive.com.br", "saas-origin.shopdrive.com.br", "domains.shopdrive.com.br",
    "nkoogfznnqlnragbauez.supabase.co", "virtualmercado.lovable.app"])("%s passes through without store resolution", async (host) => {
    const req = new Request(`https://${host}/painel?x=1`, { headers: { cookie: "a=b", authorization: "Bearer t" } });
    const r = await worker.fetch(req);
    expect(await r.text()).toBe("origin-passthrough");
    expect(calls).toHaveLength(1);
    expect(calls[0].request).toBe(req);
  });
});

describe("F — workers.dev is not a store", () => {
  it("returns 421 without asking the resolver", async () => {
    const r = await worker.fetch(new Request("https://shopdrive-custom-domain-router.conta.workers.dev/"));
    expect(r.status).toBe(421);
    expect(calls).toHaveLength(0);
  });
});

describe("G — fictitious active hostname resolves to its own store", () => {
  it("is proxied for its own hostname; redirect stays on that hostname", async () => {
    upstream = () => new Response(null, { status: 302, headers: { location: "https://shopdrive.com.br/login?next=%2Fconta" } });
    const r = await worker.fetch(new Request(`https://${FICTICIOUS}/conta`));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe(`https://${FICTICIOUS}/login?next=%2Fconta`);
  });
});

describe("H — redirects", () => {
  const redirectTo = async (host: string, location: string) => {
    upstream = () => new Response(null, { status: 301, headers: { location } });
    return (await worker.fetch(new Request(`https://${host}/x`))).headers.get("location");
  };
  it("absolute shopdrive.com.br and www redirects move to the current hostname over https", async () => {
    expect(await redirectTo(AROMA, "https://shopdrive.com.br/a?b=1")).toBe(`https://${AROMA}/a?b=1`);
    expect(await redirectTo(FICTICIOUS, "http://www.shopdrive.com.br/c#d")).toBe(`https://${FICTICIOUS}/c#d`);
    expect(await redirectTo(FICTICIOUS, "//shopdrive.com.br/e")).toBe(`https://${FICTICIOUS}/e`);
  });
  it("relative and external redirects are left unchanged", async () => {
    expect(await redirectTo(FICTICIOUS, "/login")).toBe("/login");
    expect(await redirectTo(FICTICIOUS, "https://www.mercadopago.com.br/checkout")).toBe("https://www.mercadopago.com.br/checkout");
    expect(await redirectTo(FICTICIOUS, "https://painel.shopdrive.com.br/x")).toBe("https://painel.shopdrive.com.br/x");
  });
  it("a merchant is never redirected to AROMA", async () => {
    expect(await redirectTo(FICTICIOUS, "https://shopdrive.com.br/")).not.toContain("redearoma");
  });
});

describe("I — spoofed headers are ignored", () => {
  it("client host/context/cookie/authorization headers never reach the upstream; worker sets its own", async () => {
    await worker.fetch(new Request(`https://${FICTICIOUS}/`, {
      headers: {
        "x-forwarded-host": "shopdrive.com.br", "x-shopdrive-custom-hostname": AROMA, "x-original-host": AROMA,
        cookie: "sb-token=secret", authorization: "Bearer secret", "accept-language": "pt-BR",
      },
    }));
    const h = new Headers(upstreamCalls()[0].init!.headers);
    expect(h.get("x-forwarded-host")).toBe(FICTICIOUS);
    expect(h.get("x-shopdrive-custom-hostname")).toBeNull();
    expect(h.get("x-original-host")).toBeNull();
    expect(h.get("cookie")).toBeNull();
    expect(h.get("authorization")).toBeNull();
    expect(h.get("accept-language")).toBe("pt-BR");
    expect(upstreamCalls()[0].init!.redirect).toBe("manual");
  });
  it("loop-stamped requests fail closed", async () => {
    const r = await worker.fetch(new Request(`https://${FICTICIOUS}/`, { headers: { "x-shopdrive-custom-domain": "1" } }));
    expect(r.status).toBe(508);
  });
});

describe("J — allowed methods match the published pilot", () => {
  it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])("%s is proxied", async (method) => {
    const body = method === "GET" || method === "HEAD" ? undefined : "x";
    expect((await worker.fetch(new Request(`https://${AROMA}/`, { method, body }))).status).toBe(200);
    expect(upstreamCalls()[0].init!.method).toBe(method);
  });
  it("other methods get 405 with the same Allow list", async () => {
    const r = await worker.fetch(new Request(`https://${AROMA}/`, { method: "PROPFIND" }));
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe("GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    expect(await r.text()).toBe("Método não permitido.");
    expect(upstreamCalls()).toHaveLength(0);
  });
});

describe("logging", () => {
  it("logs only hostname, status, duration and code", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await worker.fetch(new Request("https://www.desconhecido-exemplo.com/", { headers: { cookie: "a=b", authorization: "Bearer z" } }));
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(Object.keys(line).sort()).toEqual(["code", "host", "ms", "status"]);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Bearer|a=b/);
    spy.mockRestore();
  });
});
