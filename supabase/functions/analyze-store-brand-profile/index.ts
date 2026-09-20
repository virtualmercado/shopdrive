import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  OFFICIAL_PALETTES,
  OFFICIAL_PALETTE_IDS,
  OFFICIAL_LAYOUTS,
  OFFICIAL_LAYOUT_IDS,
} from "../_shared/storePalettes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "openai/gpt-6-astra";

interface BrandProfile {
  business_summary: string;
  target_audience_summary: string;
  positioning: string;
  visual_style: string;
  recommended_palette_id: string;
  recommended_layout_id: string;
  reasoning_short: string;
  confidence: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeForHash(parts: (string | null | undefined)[]) {
  return parts
    .map((p) => (p ?? "").toString().toLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Fallback determinístico: nunca quebra o onboarding se a IA estiver indisponível. */
function deterministicProfile(ctx: string, category: string): BrandProfile {
  const t = `${ctx} ${category}`.toLowerCase();
  const pick = (kw: string[], id: string) => (kw.some((k) => t.includes(k)) ? id : null);
  const palette =
    pick(["natural", "orgânic", "organic", "sustentáv", "cosmétic", "erva"], "verde-natural") ||
    pick(["tênis", "tenis", "esport", "fitness", "academia"], "laranja-urbano") ||
    pick(["moda", "luxo", "sofisticad", "joia", "premium"], "elegante-escura") ||
    pick(["infantil", "kids", "festa", "divertid"], "pop-colorida") ||
    pick(["tecnolog", "eletrôn", "informát", "serviço"], "azul-profissional") ||
    pick(["feminin", "beleza", "estétic"], "suave-feminina") ||
    "neutra-clean";
  const layout =
    pick(["promoç", "oferta", "desconto", "preço baixo", "atacado"], "layout_02") ||
    pick(["marca", "história", "storytelling", "autoridade", "lifestyle", "conteúdo"], "layout_03") ||
    "layout_01";
  return {
    business_summary: ctx.slice(0, 280) || category.slice(0, 280),
    target_audience_summary: "",
    positioning: "",
    visual_style: "",
    recommended_palette_id: palette,
    recommended_layout_id: layout,
    reasoning_short:
      "Sugestão baseada no segmento e nas informações que você escreveu sobre o negócio.",
    confidence: 0.4,
  };
}

async function callTextAi(prompt: string): Promise<{ text: string } | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      business_summary: { type: "string" },
      target_audience_summary: { type: "string" },
      positioning: { type: "string" },
      visual_style: { type: "string" },
      recommended_palette_id: { type: "string", enum: OFFICIAL_PALETTE_IDS },
      recommended_layout_id: { type: "string", enum: OFFICIAL_LAYOUT_IDS },
      reasoning_short: { type: "string" },
      confidence: { type: "number" },
    },
    required: [
      "business_summary",
      "target_audience_summary",
      "positioning",
      "visual_style",
      "recommended_palette_id",
      "recommended_layout_id",
      "reasoning_short",
      "confidence",
    ],
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "brand_profile",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    console.error("text ai error", res.status, await res.text().catch(() => ""));
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          out += evt.delta;
        }
        if (evt.type === "response.completed" && !out && evt.response?.output_text) {
          out = evt.response.output_text;
        }
      } catch {
        /* frame parcial ignorado */
      }
    }
  }
  return out ? { text: out } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const storeId: string = body.store_id ?? user.id;
    const force = body.force === true;

    if (storeId !== user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }

    const [{ data: profile }, { data: state }] = await Promise.all([
      admin
        .from("profiles")
        .select("store_name, store_category, city, store_slug")
        .eq("id", storeId)
        .maybeSingle(),
      admin
        .from("store_onboarding_state")
        .select("business_context, context_hash, brand_profile, brand_status, brand_analyzed_at, brand_model")
        .eq("store_id", storeId)
        .maybeSingle(),
    ]);

    const businessContext = (state?.business_context ?? "").toString();
    const category = (profile?.store_category ?? "").toString();

    const hash = await sha256(
      normalizeForHash([businessContext, category, profile?.store_name, profile?.city])
    );

    // Cache: mesmo conteúdo já analisado => não chama IA de novo.
    if (!force && state?.context_hash === hash && state?.brand_profile) {
      return json({
        cached: true,
        context_hash: hash,
        brand_profile: state.brand_profile,
        model: state.brand_model,
        analyzed_at: state.brand_analyzed_at,
        status: state.brand_status,
      });
    }

    const paletteCatalogue = OFFICIAL_PALETTES.map(
      (p) =>
        `- ${p.id}: ${p.name} — ${p.description} (primária ${p.colors.primary}, secundária ${p.colors.secondary})`
    ).join("\n");
    const layoutCatalogue = OFFICIAL_LAYOUTS.map(
      (l) => `- ${l.id}: ${l.name} — ${l.description}`
    ).join("\n");

    const prompt = `Você é consultor de identidade visual de lojas virtuais brasileiras.
Analise o contexto interno do negócio e escolha EXATAMENTE UMA paleta e UM layout do catálogo oficial abaixo.
Nunca invente paletas, cores, layouts ou templates. Use somente os IDs listados.
Responda em português do Brasil, com frases curtas e amigáveis, sem jargão técnico.
Não repita literalmente o texto do lojista e não afirme fatos comerciais que ele não escreveu.

Loja: ${profile?.store_name ?? "(sem nome)"}
Segmento declarado: ${category || "(não informado)"}
Cidade/região: ${profile?.city ?? "(não informada)"}

Contexto do negócio escrito pelo lojista:
"""
${businessContext.slice(0, 4000) || "(não informado)"}
"""

PALETAS OFICIAIS:
${paletteCatalogue}

LAYOUTS OFICIAIS:
${layoutCatalogue}

Orientação de layout: layout_01 quando a loja precisa de estrutura equilibrada e generalista; layout_02 quando a prioridade declarada é venda rápida, preço, ofertas e promoções; layout_03 quando marca, storytelling, lifestyle ou autoridade são centrais. Considere o contexto completo, não apenas palavras isoladas.
Em reasoning_short, explique a escolha em no máximo 2 frases, falando diretamente com o lojista.
confidence: número entre 0 e 1.`;

    const started = Date.now();
    let profileResult: BrandProfile | null = null;
    let usedFallback = false;

    const ai = await callTextAi(prompt).catch((e) => {
      console.error("text ai exception", e);
      return null;
    });

    if (ai?.text) {
      try {
        const parsed = JSON.parse(ai.text) as BrandProfile;
        if (
          OFFICIAL_PALETTE_IDS.includes(parsed.recommended_palette_id) &&
          OFFICIAL_LAYOUT_IDS.includes(parsed.recommended_layout_id)
        ) {
          profileResult = parsed;
        }
      } catch (e) {
        console.error("invalid ai json", e);
      }
    }

    if (!profileResult) {
      profileResult = deterministicProfile(businessContext, category);
      usedFallback = true;
    }

    const status = usedFallback ? "fallback" : "recommended";
    await admin
      .from("store_onboarding_state")
      .update({
        brand_profile: profileResult,
        context_hash: hash,
        brand_analyzed_at: new Date().toISOString(),
        brand_provider: usedFallback ? "deterministic" : "lovable-ai-gateway",
        brand_model: usedFallback ? null : MODEL,
        brand_confidence: profileResult.confidence ?? null,
        brand_status: status,
        recommended_palette_id: profileResult.recommended_palette_id,
        recommended_layout_id: profileResult.recommended_layout_id,
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId);

    await admin.from("store_onboarding_events").insert({
      store_id: storeId,
      user_id: user.id,
      event_type: "AI_STORE_IDENTITY_RECOMMENDED",
      step: "visual",
      metadata: {
        palette_id: profileResult.recommended_palette_id,
        layout_id: profileResult.recommended_layout_id,
        context_hash: hash,
        fallback: usedFallback,
        elapsed_ms: Date.now() - started,
      },
    });

    return json({
      cached: false,
      fallback: usedFallback,
      context_hash: hash,
      brand_profile: profileResult,
      model: usedFallback ? "deterministic" : MODEL,
      status,
    });
  } catch (error) {
    console.error("analyze-store-brand-profile error", error);
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
