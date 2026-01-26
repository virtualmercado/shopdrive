import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ColorPalette {
  primary: string;
  secondary: string;
  headerBg: string;
  headerText: string;
  buttonBg: string;
  buttonText: string;
  footerBg: string;
  footerText: string;
}

interface RefineRequest {
  basePalette: ColorPalette;
  paletteName: string;
  refinementPrompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { basePalette, paletteName, refinementPrompt } = await req.json() as RefineRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert color palette designer for e-commerce stores. You will refine color palettes based on user requests while maintaining:
1. High contrast for readability (WCAG AA minimum)
2. CTA buttons must always stand out
3. Text on dark backgrounds must be light and vice-versa
4. Maintain harmony between colors
5. Ensure hover states are slightly lighter or darker than base colors

You must respond with a valid JSON object containing the refined color palette. Each color must be a valid hex code.`;

    const userPrompt = `Base palette "${paletteName}":
- Primary: ${basePalette.primary}
- Secondary: ${basePalette.secondary}
- Header Background: ${basePalette.headerBg}
- Header Text: ${basePalette.headerText}
- Button Background: ${basePalette.buttonBg}
- Button Text: ${basePalette.buttonText}
- Footer Background: ${basePalette.footerBg}
- Footer Text: ${basePalette.footerText}

User request: "${refinementPrompt}"

Generate a refined palette that applies the user's request while maintaining good contrast and visual hierarchy.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_color_palette",
              description: "Generate a refined color palette for an e-commerce store",
              parameters: {
                type: "object",
                properties: {
                  primary: { 
                    type: "string", 
                    description: "Primary brand color (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  secondary: { 
                    type: "string", 
                    description: "Secondary/accent color (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  headerBg: { 
                    type: "string", 
                    description: "Header background color (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  headerText: { 
                    type: "string", 
                    description: "Header text color - must contrast with headerBg (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  buttonBg: { 
                    type: "string", 
                    description: "Button background color for CTAs (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  buttonText: { 
                    type: "string", 
                    description: "Button text color - must contrast with buttonBg (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  footerBg: { 
                    type: "string", 
                    description: "Footer background color (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  },
                  footerText: { 
                    type: "string", 
                    description: "Footer text color - must contrast with footerBg (hex code)",
                    pattern: "^#[0-9A-Fa-f]{6}$"
                  }
                },
                required: ["primary", "secondary", "headerBg", "headerText", "buttonBg", "buttonText", "footerBg", "footerText"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_color_palette" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "generate_color_palette") {
      throw new Error("Invalid AI response format");
    }

    const refinedColors = JSON.parse(toolCall.function.arguments);

    // Validate that all colors are valid hex codes
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const colorKeys = ["primary", "secondary", "headerBg", "headerText", "buttonBg", "buttonText", "footerBg", "footerText"];
    
    for (const key of colorKeys) {
      if (!refinedColors[key] || !hexPattern.test(refinedColors[key])) {
        // Fall back to base palette color if invalid
        refinedColors[key] = basePalette[key as keyof ColorPalette];
      }
    }

    return new Response(
      JSON.stringify({ colors: refinedColors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error refining palette:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
