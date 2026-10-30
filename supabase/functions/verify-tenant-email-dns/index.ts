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

    // --- Authentication (required) ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerId = claimsData.claims.sub as string;
    // --- End Auth ---

    const body: VerifyRequest = await req.json();
    const { tenant_id, domain, action, cloudflare_zone_id } = body;

    if (!tenant_id || !domain) {
      return new Response(
        JSON.stringify({ error: "tenant_id e domain são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: the caller may only touch their OWN tenant, unless Master/admin.
    // The client-supplied tenant_id is never trusted on its own.
    if (callerId !== tenant_id) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      if (isAdmin !== true) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para este tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Bind the domain to the tenant's stored settings: a caller can never choose
    // an arbitrary domain or another tenant's domain.
    const normalizedDomain = String(domain).trim().toLowerCase().replace(/\.$/, "");
    const { data: ownSettings } = await supabase
      .from("tenant_email_settings")
      .select("email_domain, cloudflare_zone_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    const storedDomain = String(ownSettings?.email_domain ?? "").trim().toLowerCase().replace(/\.$/, "");
    const PLATFORM_DOMAINS = ["shopdrive.com.br", "virtualmercado.com.br", "lovable.app", "lovable.dev"];
    const isPlatformDomain = (d: string) => PLATFORM_DOMAINS.some((p) => d === p || d.endsWith(`.${p}`));
    if (action === "create_cloudflare" || action === "remove_cloudflare") {
      if (!storedDomain || storedDomain !== normalizedDomain || isPlatformDomain(normalizedDomain)) {
        return new Response(
          JSON.stringify({ error: "Domínio não corresponde à configuração do tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { count: otherOwners } = await supabase
        .from("tenant_email_settings")
        .select("tenant_id", { count: "exact", head: true })
        .eq("email_domain", ownSettings!.email_domain)
        .neq("tenant_id", tenant_id);
      if ((otherOwners ?? 0) > 0) {
        return new Response(
          JSON.stringify({ error: "Domínio já vinculado a outro tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify that a Cloudflare zone really belongs to the tenant's domain.
    const zoneMatchesDomain = async (zoneId: string, cfToken: string): Promise<boolean> => {
      if (!/^[a-f0-9]{32}$/.test(zoneId)) return false;
      try {
        const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
          headers: { Authorization: `Bearer ${cfToken}` },
        });
        const j = await r.json();
        const zoneName = String(j?.result?.name ?? "").toLowerCase();
        if (!j?.success || !zoneName || isPlatformDomain(zoneName)) return false;
        return normalizedDomain === zoneName || normalizedDomain.endsWith(`.${zoneName}`);
      } catch (_) {
        return false;
      }
    };

    // Remove Cloudflare records for tenant
    if (action === "remove_cloudflare") {
      const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
      if (!CLOUDFLARE_API_TOKEN) {
        return new Response(
          JSON.stringify({ error: "CLOUDFLARE_API_TOKEN não configurado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all stored DNS records for this tenant
      const { data: existingRecords } = await supabase
        .from("tenant_email_dns_records")
        .select("*")
        .eq("tenant_id", tenant_id);

      let removed = 0;
      if (existingRecords && existingRecords.length > 0) {
        // Get zone_id from tenant settings
        const { data: tenantCfg } = await supabase
          .from("tenant_email_settings")
          .select("cloudflare_zone_id")
          .eq("tenant_id", tenant_id)
          .single();

        // Only the zone previously validated and stored for this tenant is used.
        const zoneId = tenantCfg?.cloudflare_zone_id as string | undefined;
        if (zoneId && await zoneMatchesDomain(zoneId, CLOUDFLARE_API_TOKEN)) {
          for (const rec of existingRecords) {
            try {
              await fetch(
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${rec.record_id_cloudflare}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
                }
              );
              removed++;
            } catch (e) {
              console.error(`Failed to delete CF record ${rec.record_id_cloudflare}:`, e);
            }
          }
        }

        // Remove from database
        await supabase
          .from("tenant_email_dns_records")
          .delete()
          .eq("tenant_id", tenant_id);
      }

      return new Response(
        JSON.stringify({ success: true, records_removed: removed }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      if (!(await zoneMatchesDomain(cloudflare_zone_id, CLOUDFLARE_API_TOKEN))) {
        return new Response(
          JSON.stringify({ error: "Zona Cloudflare não corresponde ao domínio do tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get tenant info for standardized comment
      const { data: tenantSettings } = await supabase
        .from("tenant_email_settings")
        .select("sender_name")
        .eq("tenant_id", tenant_id)
        .single();

      const tenantName = tenantSettings?.sender_name || "Unknown";
      const shortId = tenant_id.substring(0, 8);
      const comment = `ShopDrive | Tenant: ${tenantName} | ID: ${shortId} | Email Auth`;

      const records = [
        {
          type: "TXT",
          name: normalizedDomain,
          content: `v=spf1 include:shopdrive.com.br ~all`,
          label: "SPF",
        },
        {
          type: "TXT",
          name: `shopdrive._domainkey.${normalizedDomain}`,
          content: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ`,
          label: "DKIM",
        },
        {
          type: "TXT",
          name: `_dmarc.${normalizedDomain}`,
          content: `v=DMARC1; p=quarantine; rua=mailto:dmarc@shopdrive.com.br`,
          label: "DMARC",
        },
      ];

      // Remove existing records first to avoid duplicates
      const { data: oldRecords } = await supabase
        .from("tenant_email_dns_records")
        .select("record_id_cloudflare")
        .eq("tenant_id", tenant_id);

      if (oldRecords && oldRecords.length > 0) {
        for (const old of oldRecords) {
          try {
            await fetch(
              `https://api.cloudflare.com/client/v4/zones/${ownSettings?.cloudflare_zone_id || cloudflare_zone_id}/dns_records/${old.record_id_cloudflare}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
              }
            );
          } catch (_) { /* ignore */ }
        }
        await supabase.from("tenant_email_dns_records").delete().eq("tenant_id", tenant_id);
      }

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
            record_comment: comment,
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
