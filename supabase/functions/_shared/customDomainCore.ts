// Pure Custom Domains V2 rules shared by the edge function and unit tests.
// No Deno/browser globals here: DNS access is injected through `Resolver`.

export type NormalizeResult = { ok: true; domain: string } | { ok: false; reason: "invalid" | "reserved" };

export const RESERVED_DOMAIN_SUFFIXES = [
  "shopdrive.com.br",
  "virtualmercado.com.br",
  "lovable.app",
  "lovable.dev",
  "lovableproject.com",
  "supabase.co",
  "supabase.in",
  "supabase.com",
];

const LABELS = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/;

/** Exact browser/admin hostname: no URL, whitespace, port, path or www removal. */
export function normalizeExactDomainHostname(input: string): string | null {
  const host = (input ?? "").toLowerCase().replace(/\.$/, "");
  return host.length <= 253 && LABELS.test(host) && !isReservedDomain(host) ? host : null;
}

/** Pilot authority comes only from the protected access row, not request parameters. */
export function getPilotVerificationHostname(opts: {
  isAdmin: boolean; storeId: string; domainMerchantId: string; canonicalDomain: string;
  access: { store_id: string; enabled: boolean; pilot_hostname: string | null } | null;
}): string | null {
  if (!opts.isAdmin || !opts.access?.enabled || opts.access.store_id !== opts.storeId || opts.domainMerchantId !== opts.storeId) return null;
  const host = normalizeExactDomainHostname(opts.access.pilot_hostname ?? "");
  if (!host || host !== opts.access.pilot_hostname) return null;
  const canonical = normalizeCustomDomain(host);
  return canonical.ok && canonical.domain === opts.canonicalDomain ? host : null;
}

export function isReservedDomain(domain: string): boolean {
  return RESERVED_DOMAIN_SUFFIXES.some((r) => domain === r || domain.endsWith(`.${r}`));
}

/** Mirrors public.normalize_custom_domain + is_reserved_custom_domain. */
export function normalizeCustomDomain(input: string): NormalizeResult {
  let v = (input ?? "").trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "");
  if (/[?#@]/.test(v)) return { ok: false, reason: "invalid" };
  v = v.replace(/\/+$/, "");
  if (v.includes("/") || v.includes(":")) return { ok: false, reason: "invalid" };
  v = v.replace(/\.$/, "").replace(/^www\./, "");
  if (!v || v.length > 253 || /^[0-9.]+$/.test(v) || v === "localhost" || v.endsWith(".localhost") || !LABELS.test(v)) {
    return { ok: false, reason: "invalid" };
  }
  if (isReservedDomain(v)) return { ok: false, reason: "reserved" };
  return { ok: true, domain: v };
}

export interface DnsProvider { slug: string; name: string }

const PROVIDER_PATTERNS: Array<{ re: RegExp; slug: string; name: string }> = [
  { re: /\.ns\.cloudflare\.com$/, slug: "cloudflare", name: "Cloudflare" },
  { re: /(^|\.)dns-parking\.com$|(^|\.)hostinger\./, slug: "hostinger", name: "Hostinger" },
  { re: /(^|\.)dns\.br$|(^|\.)registro\.br$/, slug: "registro-br", name: "Registro.br" },
  { re: /(^|\.)domaincontrol\.com$/, slug: "godaddy", name: "GoDaddy" },
  { re: /(^|\.)locaweb\.com\.br$/, slug: "locaweb", name: "Locaweb" },
  { re: /(^|\.)hostgator\.com(\.br)?$|(^|\.)websitewelcome\.com$/, slug: "hostgator", name: "HostGator" },
  { re: /(^|\.)umbler\.com$/, slug: "umbler", name: "Umbler" },
  { re: /(^|\.)uolhost\.com\.br$|(^|\.)uol\.com\.br$/, slug: "uol-host", name: "UOL Host" },
];

export function detectDnsProvider(nameservers: string[]): DnsProvider | null {
  const ns = nameservers.map((n) => n.toLowerCase().replace(/\.$/, ""));
  for (const p of PROVIDER_PATTERNS) {
    if (ns.length > 0 && ns.some((n) => p.re.test(n))) return { slug: p.slug, name: p.name };
  }
  return null;
}

export type DnsStatus = "ok" | "nxdomain" | "timeout" | "error";
export interface DnsAnswer { status: DnsStatus; answers: string[] }
export type Resolver = (name: string, type: "TXT" | "NS" | "A" | "CNAME") => Promise<DnsAnswer>;

const DOH_ENDPOINTS = ["https://dns.google/resolve", "https://cloudflare-dns.com/dns-query"];

/** DNS-over-HTTPS against fixed trusted resolvers only (never user URLs), with fallback. */
export function createDohResolver(fetchImpl: typeof fetch, timeoutMs = 5000): Resolver {
  return async (name, type) => {
    let last: DnsAnswer = { status: "error", answers: [] };
    for (const endpoint of DOH_ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const url = `${endpoint}?name=${encodeURIComponent(name)}&type=${type}`;
        const res = await fetchImpl(url, { headers: { accept: "application/dns-json" }, signal: ctrl.signal });
        if (!res.ok) { last = { status: "error", answers: [] }; continue; }
        const j = await res.json();
        if (j.Status === 3) return { status: "nxdomain", answers: [] };
        if (j.Status !== 0) { last = { status: "error", answers: [] }; continue; }
        const code = { TXT: 16, NS: 2, A: 1, CNAME: 5 }[type];
        const answers = (j.Answer ?? [])
          .filter((a: { type: number }) => a.type === code)
          .map((a: { data: string }) => String(a.data).replace(/^"|"$/g, "").replace(/"\s*"/g, "").replace(/\.$/, "").toLowerCase());
        return { status: "ok", answers };
      } catch (e) {
        last = { status: (e as Error)?.name === "AbortError" ? "timeout" : "error", answers: [] };
      } finally {
        clearTimeout(timer);
      }
    }
    return last;
  };
}

export interface IngressConfig {
  ingressReady: boolean;
  rootType: string; rootValue: string | null;
  wwwType: string; wwwValue: string | null;
  txtHostPrefix: string; txtValuePrefix: string;
}

export type OwnershipStatus = "verified" | "missing" | "mismatch" | "expired" | "resolver_unavailable" | "already_verified";
export type RecordStatus = "ok" | "wrong" | "missing" | "resolver_unavailable" | "not_configured" | "not_required";

export interface VerificationResult {
  checkedAt: string;
  ownership: OwnershipStatus;
  nameservers: string[];
  provider: DnsProvider | null;
  root: RecordStatus;
  www: RecordStatus;
  observed: { txt: number; root: string[]; www: string[] };
  notes: string[];
  pilotHostname?: string;
}

export function areDnsRecordsVerified(result: VerificationResult): boolean {
  if (result.pilotHostname) return normalizeExactDomainHostname(result.pilotHostname) === result.pilotHostname && result.root === "not_required" && result.www === "ok";
  return result.root === "ok" && result.www === "ok";
}

async function checkRecord(resolve: Resolver, host: string, type: string, expected: string | null): Promise<{ s: RecordStatus; seen: string[] }> {
  if (!expected) return { s: "not_configured", seen: [] };
  const t = type.toUpperCase() === "CNAME" ? "CNAME" : "A";
  const r = await resolve(host, t);
  if (r.status === "timeout" || r.status === "error") return { s: "resolver_unavailable", seen: [] };
  if (r.status === "nxdomain" || r.answers.length === 0) return { s: "missing", seen: [] };
  const want = expected.toLowerCase().replace(/\.$/, "");
  return { s: r.answers.includes(want) ? "ok" : "wrong", seen: r.answers.slice(0, 5) };
}

export async function verifyDomain(opts: {
  domain: string;
  token: string | null;
  expiresAt: string | null;
  ownershipVerifiedAt: string | null;
  config: IngressConfig;
  resolve: Resolver;
  now?: Date;
  /** Server-selected administrative scope. Never populated from the request body. */
  pilotHostname?: string | null;
}): Promise<VerificationResult> {
  const now = opts.now ?? new Date();
  const notes: string[] = [];
  const nsRes = await opts.resolve(opts.domain, "NS");
  const nameservers = nsRes.status === "ok" ? nsRes.answers : [];
  if (nsRes.status === "nxdomain") notes.push("domain_nxdomain");
  if (nsRes.status === "timeout" || nsRes.status === "error") notes.push("ns_resolver_unavailable");
  const provider = detectDnsProvider(nameservers);
  if (!provider && nameservers.length) notes.push("provider_unknown");

  let ownership: OwnershipStatus;
  let txtCount = 0;
  if (opts.ownershipVerifiedAt) {
    ownership = "already_verified";
  } else if (!opts.token || (opts.expiresAt && new Date(opts.expiresAt) < now)) {
    ownership = "expired";
  } else {
    const txt = await opts.resolve(`${opts.config.txtHostPrefix}.${opts.domain}`, "TXT");
    txtCount = txt.answers.length;
    if (txt.status === "timeout" || txt.status === "error") ownership = "resolver_unavailable";
    else if (txt.status === "nxdomain" || txt.answers.length === 0) ownership = "missing";
    else ownership = txt.answers.includes(`${opts.config.txtValuePrefix}${opts.token}`.toLowerCase()) ? "verified" : "mismatch";
  }

  let root: RecordStatus = "not_configured";
  let www: RecordStatus = "not_configured";
  let rootSeen: string[] = [];
  let wwwSeen: string[] = [];
  const exact = normalizeExactDomainHostname(opts.pilotHostname ?? "");
  const canonical = exact ? normalizeCustomDomain(exact) : null;
  const pilotHostname = exact && exact === opts.pilotHostname && canonical?.ok && canonical.domain === opts.domain ? exact : null;
  if (opts.pilotHostname && !pilotHostname) {
    notes.push("invalid_pilot_scope");
  } else if (pilotHostname) {
    // Readiness is local to the protected host and fixed configured CNAME target; never global.
    root = "not_required";
    if (opts.config.wwwType.toUpperCase() === "CNAME") {
      const w = await checkRecord(opts.resolve, pilotHostname, "CNAME", opts.config.wwwValue);
      www = w.s; wwwSeen = w.seen;
    }
    notes.push("exact_pilot_hostname");
  } else if (opts.config.ingressReady) {
    const r = await checkRecord(opts.resolve, opts.domain, opts.config.rootType, opts.config.rootValue);
    const w = await checkRecord(opts.resolve, `www.${opts.domain}`, opts.config.wwwType, opts.config.wwwValue);
    root = r.s; www = w.s; rootSeen = r.seen; wwwSeen = w.seen;
  } else {
    notes.push("ingress_not_configured");
  }
  return { checkedAt: now.toISOString(), ownership, nameservers, provider, root, www, observed: { txt: txtCount, root: rootSeen, www: wwwSeen }, notes,
    ...(pilotHostname ? { pilotHostname } : {}) };
}

export type V2State =
  | "pending_ownership" | "ownership_verified" | "dns_pending" | "dns_verified" | "routing_provisioning"
  | "ssl_provisioning" | "active" | "ownership_error" | "dns_error" | "routing_error" | "ssl_error"
  | "needs_reverification" | "inactive" | "released";

export interface StateInput {
  current: V2State;
  result: VerificationResult;
  routingStatus: string;
  sslStatus: string;
}

/**
 * Decides the next V2 state. `active` requires ownership + scoped DNS + routing active + SSL active,
 * all reported by real checks/infrastructure. A resolver outage never downgrades or upgrades the state.
 */
export function nextV2State({ current, result, routingStatus, sslStatus }: StateInput): V2State {
  if (current === "inactive" || current === "released") return current;
  const owned = result.ownership === "verified" || result.ownership === "already_verified";
  if (!owned) {
    if (result.ownership === "resolver_unavailable") return current;
    return result.ownership === "missing" ? "pending_ownership" : "ownership_error";
  }
  if (result.root === "resolver_unavailable" || result.www === "resolver_unavailable") {
    return current === "pending_ownership" ? "ownership_verified" : current;
  }
  if (result.root === "not_configured" || result.www === "not_configured") return "dns_pending";
  if (result.root === "missing" || result.www === "missing") return "dns_pending";
  if (result.root === "wrong" || result.www === "wrong") return "dns_error";
  if (!areDnsRecordsVerified(result)) return "dns_pending";
  if (routingStatus === "error") return "routing_error";
  if (routingStatus !== "active") return routingStatus === "provisioning" ? "routing_provisioning" : "dns_verified";
  if (sslStatus === "error") return "ssl_error";
  if (sslStatus !== "active") return "ssl_provisioning";
  return "active";
}

/** Periodic revalidation: a single failure never deactivates; N consecutive ones flag reverification. */
export function applyRevalidation(prevFailures: number, dnsOk: boolean | null, threshold: number) {
  if (dnsOk === null) return { failures: prevFailures, needsReverification: prevFailures >= threshold };
  const failures = dnsOk ? 0 : prevFailures + 1;
  return { failures, needsReverification: failures >= threshold };
}

/** Public base URL: custom domain only when truly active, otherwise the ShopDrive slug URL. */
export function getStorePublicBaseUrl(store: { slug: string; customDomain?: string | null; customDomainActive?: boolean }, platformOrigin = "https://shopdrive.com.br") {
  if (store.customDomain && store.customDomainActive) return `https://${store.customDomain}`;
  return `${platformOrigin}/${store.slug}`;
}
