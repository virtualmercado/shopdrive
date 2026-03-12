import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an audit event to the audit_logs table.
 * Captures user info, IP, and user-agent automatically.
 * Fire-and-forget – never throws to avoid breaking caller flows.
 */
export const logAuditEvent = async (params: AuditLogParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch user profile for name/email/role context
    let userName = "";
    let userEmail = user?.email ?? "";
    let userRole: "admin" | "lojista" | "sistema" = "sistema";

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_name, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      userName = profile?.full_name || profile?.store_name || "";
      userEmail = profile?.email || user.email || "";

      // Check if admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roles?.some((r: any) => r.role === "admin")) {
        userRole = "admin";
      } else {
        userRole = "lojista";
      }
    }

    const enrichedMetadata: Record<string, unknown> = {
      ...params.metadata,
      description: params.description || "",
      user_name: userName,
      user_email: userEmail,
      user_role: userRole,
      user_agent: navigator.userAgent,
    };

    await supabase.rpc("log_audit_event", {
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId ?? null,
      p_metadata: enrichedMetadata as any,
      p_ip_address: null, // IP captured server-side when available
    });
  } catch (err) {
    console.error("[AuditLog] Failed to log event:", err);
  }
};
