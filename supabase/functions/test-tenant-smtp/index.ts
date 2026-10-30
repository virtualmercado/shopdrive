import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // JWT Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { smtp_host, smtp_port, smtp_user, smtp_security } = body;
    let smtp_password: string = body.smtp_password ?? "";

    if (!smtp_host || !smtp_port) {
      return new Response(JSON.stringify({ error: "Host e porta são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF guard: only standard SMTP ports and public hostnames that resolve
    // exclusively to public IP addresses.
    const host = String(smtp_host).trim().toLowerCase();
    const port = Number(smtp_port);
    const ALLOWED_PORTS = [25, 465, 587, 2525];
    const badRequest = (msg: string) => new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    if (!ALLOWED_PORTS.includes(port)) return badRequest("Porta SMTP não permitida (use 25, 465, 587 ou 2525)");
    if (host.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
      return badRequest("Host SMTP inválido");
    }
    const isPrivateIp = (ip: string): boolean => {
      const v = ip.toLowerCase();
      if (v.includes(":")) {
        return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") ||
          v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") ||
          v.startsWith("::ffff:");
      }
      const o = v.split(".").map(Number);
      if (o.length !== 4 || o.some((n) => isNaN(n))) return true;
      return o[0] === 0 || o[0] === 10 || o[0] === 127 || o[0] >= 224 ||
        (o[0] === 100 && o[1] >= 64 && o[1] <= 127) ||
        (o[0] === 169 && o[1] === 254) ||
        (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
        (o[0] === 192 && o[1] === 168) ||
        (o[0] === 192 && o[1] === 0 && o[2] === 0) ||
        (o[0] === 198 && (o[1] === 18 || o[1] === 19));
    };
    let resolved: string[] = [];
    try {
      const v4 = await Deno.resolveDns(host, "A").catch(() => [] as string[]);
      const v6 = await Deno.resolveDns(host, "AAAA").catch(() => [] as string[]);
      resolved = [...v4, ...v6];
    } catch (_) { resolved = []; }
    if (resolved.length === 0 || resolved.some(isPrivateIp)) {
      return badRequest("Host SMTP não permitido");
    }
    // Connect to a vetted address (prevents DNS rebinding between check and connect).
    const connectHost = resolved.find((ip) => !ip.includes(":")) ?? resolved[0];

    // Service-role client (also used to resolve stored password if not provided)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!smtp_password) {
      const { data: stored } = await supabase
        .from("tenant_email_settings")
        .select("smtp_password")
        .eq("tenant_id", userId)
        .maybeSingle();
      smtp_password = (stored as any)?.smtp_password ?? "";
    }


    // Attempt SMTP handshake
    let testError: string | null = null;
    let testSuccess = false;

    try {
      const conn = smtp_security === "ssl"
        ? await Deno.connectTls({ hostname: host, port })
        : await Deno.connect({ hostname: connectHost, port });

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      async function readResponse(): Promise<string> {
        const buf = new Uint8Array(4096);
        const n = await conn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      }
      async function sendCommand(cmd: string): Promise<string> {
        await conn.write(encoder.encode(cmd + "\r\n"));
        return await readResponse();
      }

      const greeting = await readResponse();
      if (!greeting.startsWith("220")) {
        throw new Error(`SMTP greeting failed: ${greeting.trim()}`);
      }

      let ehloResp = await sendCommand("EHLO shopdrive.com.br");

      if (smtp_security === "tls" && ehloResp.includes("STARTTLS")) {
        await sendCommand("STARTTLS");
        const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
        conn.read = tlsConn.read.bind(tlsConn);
        conn.write = tlsConn.write.bind(tlsConn);
        ehloResp = await sendCommand("EHLO shopdrive.com.br");
      }

      if (smtp_user && smtp_password) {
        await sendCommand("AUTH LOGIN");
        await sendCommand(btoa(smtp_user));
        const authResp = await sendCommand(btoa(smtp_password));
        if (!authResp.startsWith("235")) {
          throw new Error(`Autenticação SMTP falhou: ${authResp.trim()}`);
        }
      }

      await sendCommand("QUIT");
      conn.close();
      testSuccess = true;
    } catch (err) {
      testError = err instanceof Error ? err.message : "Erro desconhecido no teste SMTP";
    }

    // Update tenant_email_settings with test results
    const now = new Date().toISOString();


    await supabase
      .from("tenant_email_settings")
      .update({
        is_smtp_validated: testSuccess,
        last_tested_at: now,
        last_test_status: testSuccess ? "success" : "error",
        last_test_error: testError,
      } as any)
      .eq("tenant_id", userId);

    return new Response(
      JSON.stringify({
        success: testSuccess,
        message: testSuccess ? "Conexão SMTP validada com sucesso!" : `Falha no teste: ${testError}`,
        error: testError,
      }),
      {
        status: testSuccess ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("test-tenant-smtp error:", error);
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
