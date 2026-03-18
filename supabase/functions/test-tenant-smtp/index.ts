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

    const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_security } = await req.json();

    if (!smtp_host || !smtp_port) {
      return new Response(JSON.stringify({ error: "Host e porta são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Attempt SMTP handshake
    let testError: string | null = null;
    let testSuccess = false;

    try {
      const conn = smtp_security === "ssl"
        ? await Deno.connectTls({ hostname: smtp_host, port: smtp_port })
        : await Deno.connect({ hostname: smtp_host, port: smtp_port });

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
        const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: smtp_host });
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
