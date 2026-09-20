// Etapa 2 do onboarding híbrido — geração assistida de Hero (desktop + mobile)
// com preview obrigatório antes de aplicar.
//
// REGRAS DE SEGURANÇA:
// - chave OpenAI somente no backend (jamais exposta ao frontend);
// - acesso: admin OU dono da loja com flag global + autorização piloto da loja;
// - quota server-side de 3 tentativas de Hero por loja / 24h (contada nos logs);
// - imagem gerada vai para caminho temporário segregado por loja;
// - nenhuma coluna de banner é alterada sem ação explícita "apply".
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Modelo homologado no projeto OpenAI. Centralizado aqui + env var.
const FALLBACK_MODEL = "gpt-image-2.5-flare-2026-09-08";
const MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") || FALLBACK_MODEL;

const TMP_BUCKET = "media";
const FINAL_BUCKET = "product-images";
const KIND = "hero_banner";
const QUOTA_PER_24H = 3;
const MAX_DESKTOP_BANNERS = 4;
const MAX_MOBILE_BANNERS = 3;

const TARGETS = {
  desktop: { w: 1920, h: 680, source: "1536x1024", focalY: 0.5 },
  mobile: { w: 800, h: 1000, source: "1024x1536", focalY: 0.42 },
} as const;

const OBJECTIVES: Record<string, string> = {
  apresentar_loja: "apresentar a loja de forma acolhedora e profissional",
  destacar_produtos: "valorizar visualmente o tipo de produto vendido",
  divulgar_categoria: "destacar visualmente uma categoria de produtos",
  institucional: "transmitir uma imagem institucional confiável",
  promocao: "criar um clima visual de novidade e movimento",
  outro: "compor uma arte de fundo elegante e versátil",
};

async function normalize(bytes: Uint8Array, target: { w: number; h: number; focalY: number }) {
  const img = await Image.decode(bytes);
  const source = `${img.width}x${img.height}`;
  const scale = Math.max(target.w / img.width, target.h / img.height);
  const rw = Math.max(target.w, Math.round(img.width * scale));
  const rh = Math.max(target.h, Math.round(img.height * scale));
  // Proporção sempre preservada (cover) — nunca deforma nem estica.
  img.resize(rw, rh);
  const x = Math.max(0, Math.round((rw - target.w) / 2));
  const y = Math.max(0, Math.min(rh - target.h, Math.round(rh * target.focalY - target.h / 2)));
  img.crop(x, y, target.w, target.h);
  return { bytes: await img.encode(1), source, normalized: `${target.w}x${target.h}` };
}

function buildPrompt(
  profile: Record<string, unknown> | null,
  objective: string,
  guidance: string,
  variant: "desktop" | "mobile",
  brand: Record<string, unknown> | null = null,
  identity: { palette_id?: string | null; layout_id?: string | null } = {},
) {
  const objectiveText = OBJECTIVES[objective] ?? OBJECTIVES.outro;
  const composition = variant === "desktop"
    ? "Composição horizontal panorâmica: elemento focal preferencialmente à direita, mantendo cerca de 40% da área esquerda visualmente limpa e uniforme para sobreposição de texto pela plataforma."
    : "Composição vertical própria (não é um recorte da versão horizontal): elemento focal na metade inferior, com a parte superior mais limpa e uniforme para sobreposição de texto pela plataforma.";
  const s = (v: unknown, max = 300) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";
  return [
    "Arte de fundo puramente visual para banner de loja virtual, estilo fotográfico/editorial limpo e profissional.",
    composition,
    "PROIBIDO ABSOLUTAMENTE: qualquer texto, palavra, letra, número, porcentagem, preço, selo, etiqueta, logotipo, marca, ícone de rede social, telefone, endereço, site ou botão na imagem.",
    "Não representar promoções, descontos, frete grátis, formas de pagamento, certificações, avaliações ou qualquer afirmação comercial.",
    "Nunca desenhar na imagem o texto descritivo abaixo: ele serve apenas para orientar o clima visual.",
    profile?.store_category ? `Segmento da loja: ${profile.store_category}.` : "",
    s(brand?.business_summary) ? `Resumo do negócio: ${s(brand?.business_summary)}.` : "",
    s(brand?.target_audience_summary) ? `Público: ${s(brand?.target_audience_summary, 200)}.` : "",
    s(brand?.positioning) ? `Posicionamento: ${s(brand?.positioning, 200)}.` : "",
    s(brand?.visual_style) ? `Estilo visual desejado: ${s(brand?.visual_style, 200)}.` : "",
    identity.palette_id ? `Paleta oficial da loja: ${identity.palette_id}.` : "",
    identity.layout_id ? `Layout da loja: ${identity.layout_id}.` : "",
    profile?.primary_color
      ? `Paleta harmonizada com ${profile.primary_color} e ${profile.secondary_color ?? "#ffffff"}.`
      : "",
    `Objetivo visual: ${objectiveText}.`,
    guidance ? `Orientações do lojista: ${guidance}.` : "",
  ].filter(Boolean).join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let logId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({}));
    const action: string = ["generate", "apply", "discard", "status"].includes(body?.action)
      ? body.action
      : "generate";
    const storeId: string = typeof body?.store_id === "string" ? body.store_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: "store_id inválido." }, 400);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

    // Multitenancy: somente o dono da loja ou um admin.
    if (!isAdmin && storeId !== user.id) {
      return json({ error: "Sem permissão para esta loja." }, 403);
    }

    const { data: state } = await admin
      .from("store_onboarding_state")
      .select("ai_image_enabled, brand_profile, applied_palette_id, applied_layout_id")
      .eq("store_id", storeId)
      .maybeSingle();

    if (!isAdmin) {
      const { data: flag } = await admin
        .from("onboarding_feature_flags")
        .select("enabled")
        .eq("flag_key", "ENABLE_AI_IMAGE_GENERATION")
        .maybeSingle();
      if (!flag?.enabled || !state?.ai_image_enabled) {
        return json({ error: "Geração de imagem por IA ainda não está liberada para sua loja." }, 403);
      }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: usedCount } = await admin
      .from("ai_media_generation_logs")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("kind", KIND)
      .gte("created_at", since);
    const used = usedCount ?? 0;

    if (action === "status") {
      return json({
        ai_image_enabled: !!state?.ai_image_enabled || !!isAdmin,
        used_24h: used,
        quota_24h: QUOTA_PER_24H,
        remaining: Math.max(0, QUOTA_PER_24H - used),
        model: MODEL,
      });
    }

    // ---------- APLICAR / DESCARTAR ----------
    if (action === "apply" || action === "discard") {
      const generationId: string = typeof body?.generation_id === "string" ? body.generation_id : "";
      if (!/^[0-9a-f-]{36}$/i.test(generationId)) return json({ error: "generation_id inválido." }, 400);

      const { data: log } = await admin
        .from("ai_media_generation_logs")
        .select("id, store_id, status, request_payload, output_desktop_url, output_mobile_url, applied_at, discarded_at")
        .eq("generation_id", generationId)
        .eq("store_id", storeId)
        .maybeSingle();
      if (!log || log.status !== "success") return json({ error: "Geração não encontrada." }, 404);

      if (action === "discard") {
        await admin.from("ai_media_generation_logs")
          .update({ discarded_at: new Date().toISOString() })
          .eq("id", log.id);
        await admin.from("store_onboarding_events").insert({
          store_id: storeId,
          user_id: user.id,
          event_type: "AI_BANNER_DISCARDED",
          step: "showcase",
          metadata: { generation_id: generationId, at: new Date().toISOString() },
        });
        return json({ ok: true, discarded: true });
      }

      if (log.applied_at) return json({ error: "Esta geração já foi aplicada." }, 409);

      const payload = (log.request_payload ?? {}) as Record<string, string>;
      const { data: profile } = await admin
        .from("profiles")
        .select("banner_desktop_urls, banner_mobile_urls")
        .eq("id", storeId)
        .maybeSingle();

      const desktopList: string[] = Array.isArray(profile?.banner_desktop_urls)
        ? (profile!.banner_desktop_urls as string[])
        : [];
      const mobileList: string[] = Array.isArray(profile?.banner_mobile_urls)
        ? (profile!.banner_mobile_urls as string[])
        : [];

      if (desktopList.length >= MAX_DESKTOP_BANNERS || mobileList.length >= MAX_MOBILE_BANNERS) {
        return json({
          error: "Sua loja já atingiu o número máximo de banners. Remova um banner em Personalizar antes de aplicar.",
        }, 409);
      }

      // Regulariza: copia do temporário para o bucket definitivo de banners.
      const finalUrls: Record<string, string> = {};
      for (const variant of ["desktop", "mobile"] as const) {
        const tmpPath = payload[`${variant}_path`];
        if (!tmpPath) return json({ error: "Arquivo temporário indisponível." }, 410);
        const { data: file, error: dlError } = await admin.storage.from(TMP_BUCKET).download(tmpPath);
        if (dlError || !file) return json({ error: "Arquivo temporário indisponível." }, 410);
        const finalPath = `${storeId}/ai_banner_${variant}_${generationId}.png`;
        const { error: upError } = await admin.storage
          .from(FINAL_BUCKET)
          .upload(finalPath, new Uint8Array(await file.arrayBuffer()), {
            contentType: "image/png",
            upsert: true,
          });
        if (upError) return json({ error: "Falha ao salvar o banner." }, 500);
        finalUrls[variant] = admin.storage.from(FINAL_BUCKET).getPublicUrl(finalPath).data.publicUrl;
      }

      // Mesmo fluxo de persistência do editor de banners (append + limpa legado).
      const { error: updError } = await admin
        .from("profiles")
        .update({
          banner_desktop_urls: [...desktopList, finalUrls.desktop],
          banner_mobile_urls: [...mobileList, finalUrls.mobile],
          banner_desktop_url: null,
          banner_mobile_url: null,
        })
        .eq("id", storeId);
      if (updError) return json({ error: "Não foi possível aplicar o banner." }, 500);

      await admin.from("ai_media_generation_logs")
        .update({ applied_at: new Date().toISOString() })
        .eq("id", log.id);
      await admin.from("store_onboarding_events").insert({
        store_id: storeId,
        user_id: user.id,
        event_type: "AI_BANNER_APPLIED",
        step: "showcase",
        metadata: {
          generation_id: generationId,
          store_id: storeId,
          at: new Date().toISOString(),
          desktop_url: finalUrls.desktop,
          mobile_url: finalUrls.mobile,
        },
      });
      try {
        await admin.rpc("recompute_store_onboarding_state", { p_store_id: storeId });
      } catch (_err) {
        // recomputação é best-effort; o banner já foi aplicado
      }

      return json({ ok: true, applied: true, urls: finalUrls, slide_index: desktopList.length });
    }

    // ---------- GERAR ----------
    if (used >= QUOTA_PER_24H) {
      return json({
        error: `Você já usou as ${QUOTA_PER_24H} criações de imagem disponíveis nas últimas 24 horas. Tente novamente amanhã ou envie sua própria imagem.`,
        quota_exceeded: true,
        used_24h: used,
        quota_24h: QUOTA_PER_24H,
      }, 429);
    }

    // Concorrência / duplo clique: uma geração pendente recente bloqueia nova chamada paga.
    const pendingSince = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: pendingRows } = await admin
      .from("ai_media_generation_logs")
      .select("generation_id")
      .eq("store_id", storeId)
      .eq("kind", KIND)
      .eq("status", "pending")
      .gte("created_at", pendingSince)
      .limit(1);
    if (pendingRows && pendingRows.length > 0) {
      return json({
        error: "Já existe uma criação de imagem em andamento para esta loja. Aguarde a conclusão.",
        in_progress: true,
        generation_id: pendingRows[0].generation_id,
      }, 409);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "Geração de imagem indisponível: chave não configurada." }, 500);
    }

    const objective = String(body?.objective ?? "outro").slice(0, 60);
    const guidance = String(body?.additional_guidance ?? "").slice(0, 400);
    const generationId = crypto.randomUUID();
    const startedAt = Date.now();

    // Perfil estruturado da marca (interno) — nunca desenhado na arte.
    const brand = (state?.brand_profile ?? null) as Record<string, unknown> | null;
    const identity = {
      palette_id: state?.applied_palette_id ?? null,
      layout_id: state?.applied_layout_id ?? null,
    };

    // Apenas contexto público da loja — nunca pedidos, clientes ou dados financeiros.
    const { data: profile } = await admin
      .from("profiles")
      .select("store_name, store_category, store_description, primary_color, secondary_color")
      .eq("id", storeId)
      .maybeSingle();

    const { data: logRow } = await admin
      .from("ai_media_generation_logs")
      .insert({
        store_id: storeId,
        user_id: user.id,
        origin: isAdmin && storeId !== user.id ? "admin_smoke_test" : "onboarding_showcase",
        target_slot: "main_banner",
        kind: KIND,
        generation_id: generationId,
        model_name: MODEL,
        request_payload: { objective, additional_guidance: guidance },
        prompt_summary: buildPrompt(profile, objective, guidance, "desktop", brand, identity).slice(0, 500),
        status: "pending",
      })
      .select("id")
      .single();
    logId = logRow?.id ?? null;

    const results: Record<string, { url: string; path: string }> = {};
    const sourceSizes: Record<string, string> = {};
    const normalizedSizes: Record<string, string> = {};
    const usageTotals: Record<string, unknown>[] = [];

    for (const variant of ["desktop", "mobile"] as const) {
      const target = TARGETS[variant];
      const aiRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          prompt: buildPrompt(profile, objective, guidance, variant, brand, identity),
          size: target.source,
          n: 1,
        }),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        if (logId) {
          await admin.from("ai_media_generation_logs").update({
            status: "error",
            error_message: detail.slice(0, 1000),
            duration_ms: Date.now() - startedAt,
            finished_at: new Date().toISOString(),
          }).eq("id", logId);
        }
        const message = aiRes.status === 429
          ? "Limite de uso da IA atingido. Tente novamente em instantes."
          : "Não foi possível criar a imagem agora. Você pode enviar sua própria imagem.";
        return json({ error: message }, aiRes.status === 429 ? 429 : 502);
      }

      const aiJson = await aiRes.json();
      const b64: string | undefined = aiJson?.data?.[0]?.b64_json;
      if (!b64) {
        if (logId) {
          await admin.from("ai_media_generation_logs").update({
            status: "error",
            error_message: "resposta sem imagem",
            duration_ms: Date.now() - startedAt,
            finished_at: new Date().toISOString(),
          }).eq("id", logId);
        }
        return json({ error: "A IA não retornou uma imagem." }, 502);
      }
      if (aiJson?.usage) usageTotals.push({ variant, ...aiJson.usage });

      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const normalized = await normalize(raw, target);
      sourceSizes[variant] = normalized.source;
      normalizedSizes[variant] = normalized.normalized;

      const path = `${storeId}/ai/tmp/banner/${generationId}/${variant}.png`;
      const { error: uploadError } = await admin.storage
        .from(TMP_BUCKET)
        .upload(path, normalized.bytes, { contentType: "image/png", upsert: true });
      if (uploadError) {
        if (logId) {
          await admin.from("ai_media_generation_logs").update({
            status: "error",
            error_message: uploadError.message,
            duration_ms: Date.now() - startedAt,
            finished_at: new Date().toISOString(),
          }).eq("id", logId);
        }
        return json({ error: "Falha ao salvar a imagem gerada." }, 500);
      }
      results[variant] = {
        url: admin.storage.from(TMP_BUCKET).getPublicUrl(path).data.publicUrl,
        path,
      };
    }

    if (logId) {
      await admin.from("ai_media_generation_logs").update({
        status: "success",
        output_url: results.desktop.url,
        output_desktop_url: results.desktop.url,
        output_mobile_url: results.mobile.url,
        image_count: 2,
        duration_ms: Date.now() - startedAt,
        usage_payload: usageTotals.length ? { calls: usageTotals } : null,
        source_sizes: sourceSizes,
        normalized_sizes: normalizedSizes,
        request_payload: {
          objective,
          additional_guidance: guidance,
          desktop_path: results.desktop.path,
          mobile_path: results.mobile.path,
        },
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    // Nenhuma coluna de banner é alterada aqui — só após "apply".
    return json({
      generation_id: generationId,
      model: MODEL,
      desktop_url: results.desktop.url,
      mobile_url: results.mobile.url,
      normalized_sizes: normalizedSizes,
      source_sizes: sourceSizes,
      duration_ms: Date.now() - startedAt,
      used_24h: used + 1,
      quota_24h: QUOTA_PER_24H,
    });
  } catch (err) {
    console.error("[generate-ai-image]", err);
    if (logId) {
      await admin.from("ai_media_generation_logs").update({
        status: "error",
        error_message: String(err).slice(0, 1000),
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
    }
    return json({ error: "Erro inesperado na geração de imagem." }, 500);
  }
});
