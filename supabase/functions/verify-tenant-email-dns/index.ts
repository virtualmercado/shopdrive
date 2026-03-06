import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyRequest {
  tenant_id: string;
  domain: string;
  action?: "verify" | "create_cloudflare" | "remove_cloudflare";
  cloudflare_zone_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: VerifyRequest = await req.json();
    const { tenant_id, domain, action, cloudflare_zone_id } = body;

    if (!tenant_id || !domain) {
      return new Response(
        JSON.stringify({ error: "tenant_id e domain são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cloudflare record creation
    if (action === "create_cloudflare" && cloudflare_zone_id) {
      const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
      if (!CLOUDFLARE_API_TOKEN) {
        return new Response(
          JSON.stringify({ error: "CLOUDFLARE_API_TOKEN não configurado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get tenant info for comment
      const { data: tenantSettings } = await supabase
        .from("tenant_email_settings")
        .select("sender_name")
        .eq("tenant_id", tenant_id)
        .single();

      const comment = `ShopDrive Tenant: ${tenantSettings?.sender_name || "Unknown"} | Tenant ID: ${tenant_id.substring(0, 8)} | Tipo: Email Auth`;

      const records = [
        {
          type: "TXT",
          name: domain,
          content: `v=spf1 include:shopdrive.com.br ~all`,
          label: "SPF",
        },
        {
          type: "TXT",
          name: `shopdrive._domainkey.${domain}`,
          content: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ`,
          label: "DKIM",
        },
        {
          type: "TXT",
          name: `_dmarc.${domain}`,
          content: `v=DMARC1; p=quarantine; rua=mailto:dmarc@shopdrive.com.br`,
          label: "DMARC",
        },
      ];

      const createdRecords = [];

      for (const rec of records) {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${cloudflare_zone_id}/dns_records`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: rec.type,
              name: rec.name,
              content: rec.content,
              ttl: 3600,
              comment,
            }),
          }
        );

        const cfData = await cfRes.json();
        if (cfData.success && cfData.result?.id) {
          createdRecords.push({
            tenant_id,
            record_id_cloudflare: cfData.result.id,
            record_type: rec.label,
            record_name: rec.name,
            record_content: rec.content,
          });
        }
      }

      // Save created records
      if (createdRecords.length > 0) {
        await supabase.from("tenant_email_dns_records").insert(createdRecords);
      }

      // Update cloudflare_zone_id
      await supabase
        .from("tenant_email_settings")
        .update({
          cloudflare_zone_id,
          domain_status: "verifying",
          last_verification_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id);

      return new Response(
        JSON.stringify({ success: true, records_created: createdRecords.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DNS Verification via DNS lookup
    let spfVerified = false;
    let dkimVerified = false;
    let dmarcVerified = false;

    try {
      // Check SPF
      const spfRes = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
      const spfData = await spfRes.json();
      if (spfData.Answer) {
        spfVerified = spfData.Answer.some(
          (a: any) => a.data?.includes("include:shopdrive.com.br")
        );
      }

      // Check DKIM
      const dkimRes = await fetch(
        `https://dns.google/resolve?name=shopdrive._domainkey.${domain}&type=TXT`
      );
      const dkimData = await dkimRes.json();
      if (dkimData.Answer) {
        dkimVerified = dkimData.Answer.some((a: any) => a.data?.includes("DKIM1"));
      }

      // Check DMARC
      const dmarcRes = await fetch(
        `https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`
      );
      const dmarcData = await dmarcRes.json();
      if (dmarcData.Answer) {
        dmarcVerified = dmarcData.Answer.some((a: any) => a.data?.includes("DMARC1"));
      }
    } catch (dnsErr) {
      console.error("DNS lookup error:", dnsErr);
    }

    const allVerified = spfVerified && dkimVerified && dmarcVerified;
    const newStatus = allVerified ? "verified" : "verifying";

    await supabase
      .from("tenant_email_settings")
      .update({
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        dmarc_verified: dmarcVerified,
        domain_status: newStatus,
        last_verification_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id);

    return new Response(
      JSON.stringify({
        verified: allVerified,
        spf: spfVerified,
        dkim: dkimVerified,
        dmarc: dmarcVerified,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("verify-tenant-email-dns error:", error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
