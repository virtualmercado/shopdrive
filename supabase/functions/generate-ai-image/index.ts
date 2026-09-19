// Etapa 1 do onboarding híbrido — base segura de geração de imagem por IA.
// REGRAS: chave OpenAI somente no backend; acesso restrito a admin ou lojas
// autorizadas por feature flag; a imagem gerada NUNCA é gravada em colunas de
// banner de produção — apenas em storage temporário segregado por usuário.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MODEL = "gpt-image-1";
const BUCKET = "media";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let logId: string | null = null;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado." }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const storeId: string = typeof body?.store_id === "string" ? body.store_id : "";
    const objective: string = String(body?.objective ?? "").slice(0, 500);
    const guidance: string = String(body?.additional_guidance ?? "").slice(0, 500);
    const targetFormat: string = body?.target_format === "mobile_banner" ? "mobile_banner" : "desktop_banner";

    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
      return json({ error: "store_id inválido." }, 400);
    }

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (!isAdmin) {
      if (storeId !== user.id) {
        return json({ error: "Sem permissão para esta loja." }, 403);
      }
      const { data: flag } = await admin
        .from("onboarding_feature_flags")
        .select("enabled")
        .eq("flag_key", "ENABLE_AI_IMAGE_GENERATION")
        .maybeSingle();
      if (!flag?.enabled) {
        return json({ error: "Geração de imagem por IA ainda não está liberada para sua loja." }, 403);
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "Geração de imagem indisponível: chave não configurada." }, 500);
    }

    // Contexto real da loja monta o prompt no backend (fallback neutro).
    const { data: profile } = await admin
      .from("profiles")
      .select("store_name, store_category, store_description, primary_color, secondary_color")
      .eq("id", storeId)
      .maybeSingle();

    const size = targetFormat === "mobile_banner" ? "1024x1536" : "1536x1024";
    const prompt = [
      "Arte de fundo para banner de loja virtual, composição limpa e profissional.",
      "IMPORTANTE: não inclua nenhum texto, palavra, letra, número ou logotipo na imagem.",
      profile?.store_name ? `Loja: ${profile.store_name}.` : "",
      profile?.store_category ? `Segmento: ${profile.store_category}.` : "",
      profile?.store_description ? `Sobre a loja: ${profile.store_description}.` : "",
      profile?.primary_color ? `Paleta de cores próxima de ${profile.primary_color} e ${profile.secondary_color ?? "#ffffff"}.` : "",
      objective ? `Objetivo da peça: ${objective}.` : "",
      guidance ? `Orientações adicionais: ${guidance}.` : "",
      "Espaço visual livre à esquerda para sobreposição de texto pela plataforma.",
    ].filter(Boolean).join(" ");

    const { data: logRow } = await admin
      .from("ai_media_generation_logs")
      .insert({
        store_id: storeId,
        user_id: user.id,
        origin: isAdmin && storeId !== user.id ? "admin_test" : "onboarding_banner_test",
        target_slot: null,
        model_name: MODEL,
        request_payload: { objective, additional_guidance: guidance, target_format: targetFormat, size },
        prompt_summary: prompt.slice(0, 500),
        status: "pending",
      })
      .select("id")
      .single();
    logId = logRow?.id ?? null;

    const aiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, prompt, size, n: 1 }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      const message = aiRes.status === 429
        ? "Limite de uso da IA atingido. Tente novamente em instantes."
        : "Não foi possível gerar a imagem agora.";
      if (logId) {
        await admin.from("ai_media_generation_logs")
          .update({ status: "error", error_message: detail.slice(0, 1000), finished_at: new Date().toISOString() })
          .eq("id", logId);
      }
      return json({ error: message }, aiRes.status === 429 ? 429 : 502);
    }

    const aiJson = await aiRes.json();
    const b64: string | undefined = aiJson?.data?.[0]?.b64_json;
    if (!b64) {
      if (logId) {
        await admin.from("ai_media_generation_logs")
          .update({ status: "error", error_message: "resposta sem imagem", finished_at: new Date().toISOString() })
          .eq("id", logId);
      }
      return json({ error: "A IA não retornou uma imagem." }, 502);
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${storeId}/ai/banners/tmp/${Date.now()}-${crypto.randomUUID()}.png`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });

    if (uploadError) {
      if (logId) {
        await admin.from("ai_media_generation_logs")
          .update({ status: "error", error_message: uploadError.message, finished_at: new Date().toISOString() })
          .eq("id", logId);
      }
      return json({ error: "Falha ao salvar a imagem gerada." }, 500);
    }

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);

    if (logId) {
      await admin.from("ai_media_generation_logs")
        .update({ status: "success", output_url: publicUrl.publicUrl, finished_at: new Date().toISOString() })
        .eq("id", logId);
    }

    // Nenhuma coluna de banner é alterada nesta etapa.
    return json({ url: publicUrl.publicUrl, path, log_id: logId, model: MODEL });
  } catch (err) {
    console.error("[generate-ai-image]", err);
    if (logId) {
      await admin.from("ai_media_generation_logs")
        .update({ status: "error", error_message: String(err).slice(0, 1000), finished_at: new Date().toISOString() })
        .eq("id", logId);
    }
    return json({ error: "Erro inesperado na geração de imagem." }, 500);
  }
});
