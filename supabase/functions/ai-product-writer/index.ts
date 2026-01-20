import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIProductRequest {
  product_id?: string;
  category?: string;
  product_type?: string;
  target_audience?: string;
  differentiators?: string;
  tone: string;
  channel: string;
  benefits?: string;
  materials?: string;
  usage_instructions?: string;
  variations_info?: string;
  warranty_info?: string;
  generate_title?: boolean;
  existing_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: AIProductRequest = await req.json();

    // Build the prompt based on the request
    const toneDescriptions: Record<string, string> = {
      neutral: "Tom neutro e profissional, objetivo e informativo",
      persuasive: "Tom persuasivo de vendas, destacando benefícios e criando urgência",
      simple: "Tom simples e direto, fácil de entender",
      premium: "Tom premium e sofisticado, elegante e exclusivo",
    };

    const channelInstructions: Record<string, string> = {
      loja_vm: "Descrição para loja virtual, otimizada para SEO e conversão",
      instagram: "Texto para post de Instagram, com emojis moderados e hashtags relevantes no final",
      marketplace: "Descrição para marketplace (Mercado Livre, Shopee), detalhada e técnica",
      catalogo: "Texto para catálogo PDF, formal e completo",
    };

    const systemPrompt = `Você é um especialista em copywriting para e-commerce brasileiro. Sua tarefa é criar textos de produtos que convertem, são profissionais e respeitam as diretrizes fornecidas.

REGRAS IMPORTANTES:
- Escreva sempre em português brasileiro
- Nunca invente características técnicas ou promessas que não foram informadas
- Use frases neutras quando faltar informação
- O texto deve ser claro, profissional e orientado à venda
- Respeite o tom solicitado
- Adapte o texto ao canal especificado

${toneDescriptions[body.tone] || toneDescriptions.neutral}
${channelInstructions[body.channel] || channelInstructions.loja_vm}`;

    let userPrompt = `Crie conteúdo para um produto com as seguintes informações:\n\n`;
    
    if (body.category) userPrompt += `Categoria: ${body.category}\n`;
    if (body.product_type) userPrompt += `Tipo de produto: ${body.product_type}\n`;
    if (body.target_audience) userPrompt += `Público-alvo: ${body.target_audience}\n`;
    if (body.differentiators) userPrompt += `Diferenciais: ${body.differentiators}\n`;
    if (body.benefits) userPrompt += `Benefícios principais: ${body.benefits}\n`;
    if (body.materials) userPrompt += `Materiais/Ingredientes: ${body.materials}\n`;
    if (body.usage_instructions) userPrompt += `Modo de uso: ${body.usage_instructions}\n`;
    if (body.variations_info) userPrompt += `Variações disponíveis: ${body.variations_info}\n`;
    if (body.warranty_info) userPrompt += `Garantia/Informações adicionais: ${body.warranty_info}\n`;
    if (body.existing_name) userPrompt += `Nome atual do produto: ${body.existing_name}\n`;

    userPrompt += `\nRetorne um JSON válido com a seguinte estrutura:
{
  ${body.generate_title ? `"title_suggested": "Título sugerido para o produto (máximo 80 caracteres)",` : ""}
  "description_long": "Descrição completa do produto para ${body.channel === 'instagram' ? 'Instagram' : body.channel === 'marketplace' ? 'Marketplace' : body.channel === 'catalogo' ? 'Catálogo PDF' : 'loja virtual'}"
}

Retorne APENAS o JSON, sem formatação markdown, sem blocos de código.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        // Log the error
        await supabase.from("ai_product_logs").insert({
          user_id: user.id,
          store_id: user.id,
          product_id: body.product_id || null,
          category: body.category,
          product_type: body.product_type,
          target_audience: body.target_audience,
          differentiators: body.differentiators,
          tone: body.tone,
          channel: body.channel,
          benefits: body.benefits,
          materials: body.materials,
          usage_instructions: body.usage_instructions,
          variations_info: body.variations_info,
          warranty_info: body.warranty_info,
          status: "error",
          error_message: "Rate limit exceeded",
        });

        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para geração de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let parsedContent;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Log successful generation
    await supabase.from("ai_product_logs").insert({
      user_id: user.id,
      store_id: user.id,
      product_id: body.product_id || null,
      category: body.category,
      product_type: body.product_type,
      target_audience: body.target_audience,
      differentiators: body.differentiators,
      tone: body.tone,
      channel: body.channel,
      benefits: body.benefits,
      materials: body.materials,
      usage_instructions: body.usage_instructions,
      variations_info: body.variations_info,
      warranty_info: body.warranty_info,
      title_generated: parsedContent.title_suggested || null,
      description_generated: parsedContent.description_long,
      status: "success",
    });

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-product-writer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido ao gerar conteúdo" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
