// MARCA owner: creates the second own store (slot 2) with an independent owner account.
// Reuses the official provisioning (auth user insert -> handle_new_user profile/slug/role trigger)
// and the published per-store authorization model; the caller's session is never touched.
// Never logs or returns e-mails, tokens, claims or attempt fences.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESET_ORIGINS = new Set(["https://shopdrive.com.br", "https://www.shopdrive.com.br", "https://virtualmercado.lovable.app"]);
const KNOWN = new Set(["limit_reached", "ineligible", "owner_mismatch", "store_not_provisioned", "request_superseded"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ status: "unavailable" }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ status: "unauthorized" }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(auth.slice(7));
  const actor = claims?.claims?.sub;
  if (claimsError || typeof actor !== "string" || !UUID.test(actor)) return json({ status: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const key = String(body?.idempotencyKey ?? "");
  const fields = [body?.email, body?.ownerName, body?.storeName];
  if (!UUID.test(key) || fields.some((f) => typeof f !== "string" || f.length > 255)) return json({ status: "invalid_input" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const begin = () => admin.rpc("begin_marca_second_store_creation", {
    p_actor: actor, p_key: key, p_email: body.email, p_owner_name: body.ownerName, p_store_name: body.storeName,
  });
  const removeOwner = async (id: unknown) => {
    if (typeof id !== "string" || !UUID.test(id)) return;
    for (let i = 0; i < 2; i++) {
      const { error } = await admin.auth.admin.deleteUser(id).catch(() => ({ error: true }));
      if (!error) return;
    }
  };

  let { data: s, error: beginError } = await begin();
  if (!beginError && s?.cleanupUserId) {
    // An expired attempt was fenced out; its unlinked owner account must not survive.
    await removeOwner(s.cleanupUserId);
    if (s.state === "email_unavailable") ({ data: s, error: beginError } = await begin());
  }
  if (beginError || !s || typeof s.state !== "string") return json({ status: "unavailable" }, 503);
  switch (s.state) {
    case "completed": return json({ status: "completed", storeId: s.storeId, idempotent: true });
    case "limit_reached": return json({ status: "limit_reached" }, 409);
    case "in_progress": return json({ status: "in_progress" }, 202);
    case "ineligible": return json({ status: "ineligible" }, 403);
    case "invalid_input": return json({ status: "invalid_input", field: s.field }, 400);
    case "email_unavailable": return json({ status: "email_unavailable" }, 409);
    case "failed": return json({ status: "failed", code: s.code }, 409);
    case "claimed": break;
    default: return json({ status: "unavailable" }, 503);
  }

  const fence = { p_request_id: s.requestId, p_attempt_token: s.attemptToken };
  let createdHere: string | null = null;
  let userId: string | null = typeof s.existingUserId === "string" ? s.existingUserId : null;
  let createFailed = false;
  try {
    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: s.email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: s.ownerName, store_name: s.storeName, marca_store_request_id: s.requestId },
      });
      // A lost response may still have created the account: completion resolves it by the request marker.
      if (createError || !created?.user) createFailed = true;
      else userId = createdHere = created.user.id;
    }
    const { data: done, error: completeError } = await admin.rpc("complete_marca_second_store_creation", { ...fence, p_user_id: userId });
    if (completeError || !done?.storeId) {
      const raw = String(completeError?.message ?? "");
      const code = [...KNOWN].find((k) => raw.includes(k)) ?? "creation_failed";
      throw new Error(createFailed && code === "owner_mismatch" ? "email_unavailable" : code);
    }
    const origin = req.headers.get("Origin") ?? "";
    const base = RESET_ORIGINS.has(origin) ? origin : "https://shopdrive.com.br";
    const mailer = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: mailError } = await mailer.auth.resetPasswordForEmail(s.email, { redirectTo: `${base}/reset-password` })
      .catch(() => ({ error: true }));
    return json({ status: "completed", storeId: done.storeId, accessEmailSent: !mailError });
  } catch (e) {
    const code = e instanceof Error ? e.message : "creation_failed";
    // Only while this attempt still owns the request: fail it first, then remove the unlinked owner account.
    if (code !== "request_superseded") {
      const { data: owned } = await admin.rpc("fail_marca_second_store_creation", { ...fence, p_code: code });
      if (owned === true) {
        const orphan = createdHere ?? (await admin.rpc("_marca_creation_user", { p_request_id: s.requestId })).data;
        await removeOwner(orphan);
      }
    }
    console.error("[create-marca-second-store] failed", { code });
    if (code === "limit_reached") return json({ status: "limit_reached" }, 409);
    if (code === "email_unavailable") return json({ status: "email_unavailable" }, 409);
    if (code === "ineligible") return json({ status: "ineligible" }, 403);
    if (code === "request_superseded") return json({ status: "in_progress" }, 202);
    return json({ status: "failed" }, 503);
  }
});
