// Edge function: clone-store
// Duplica uma loja existente criando uma NOVA conta-loja independente.
// Apenas administradores podem invocar.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CloneOptions {
  copyProducts: boolean;
  copyCategories: boolean;
  copyBrands: boolean;
  copyImages: boolean;
  copyAppearance: boolean;
  copyBanners: boolean;
  copyShipping: boolean;
  copyPersonalization: boolean;
  copyCoupons: boolean;
  copyCustomerGroups: boolean;
  copyMarketing: boolean;
  copyPayments: boolean;
}

interface ClonePayload {
  sourceProfileId: string;
  newStoreName: string;
  newSlug: string;
  newEmail: string;
  cloneType: "varejo" | "atacado" | "outro";
  passwordStrategy: "reset_link" | "temporary_password";
  temporaryPassword?: string;
  plan: "gratis" | "pro" | "premium" | "same";
  options: CloneOptions;
}

// Fields that must NOT be carried over directly when cloning a profile.
const PROFILE_EXCLUDED_FIELDS = new Set<string>([
  "id",
  "created_at",
  "updated_at",
  "email",
  "store_name",
  "store_slug",
  "display_name",
  "last_activity",
  "deleted_at",
  "deleted_by",
  "account_status",
  "account_status_updated_at",
  "parent_account_id",
  "is_cloned_store",
  "cloned_from_profile_id",
  "clone_type",
  "cloned_at",
  "is_addon_store",
  "addon_status",
  "is_template_profile",
  "source_template_id",
]);

// Fields per category that group "scope": when option is OFF, strip these from profile copy.
const APPEARANCE_FIELDS = [
  "primary_color", "secondary_color", "font_family", "font_weight",
  "button_bg_color", "button_text_color", "footer_bg_color", "footer_text_color",
  "store_logo_url", "product_image_format", "product_border_style",
  "product_text_alignment", "product_button_display", "button_border_style",
  "store_layout", "store_model", "header_logo_position",
];

const BANNER_FIELDS = [
  "banner_desktop_url", "banner_mobile_url",
  "banner_desktop_urls", "banner_mobile_urls",
  "banner_rect_1_url", "banner_rect_2_url",
  "minibanner_1_img2_url", "minibanner_2_img2_url",
  "selected_benefit_banners",
  "content_banner_enabled", "content_banner_title", "content_banner_subtitle",
  "content_banner_title_color", "content_banner_subtitle_color",
  "content_banner_url", "content_banner_image_url", "content_banners",
  "topbar_enabled", "topbar_bg_color", "topbar_text_color", "topbar_text",
  "topbar_link_type", "topbar_link_target",
  "home_video_enabled", "home_video_provider", "home_video_id",
  "home_video_url_original", "home_video_title", "home_video_description",
];

const PERSONALIZATION_FIELDS = [
  "about_us_text", "about_us_title", "return_policy_text",
  "reviews_section_title", "store_description",
  "show_whatsapp_button", "whatsapp_number",
  "instagram_url", "facebook_url", "x_url", "youtube_url",
];

function stripFields(obj: Record<string, unknown>, fields: string[]) {
  for (const f of fields) delete obj[f];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Validate caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminUserId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: adminUserId, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Validate payload
    const payload = (await req.json()) as ClonePayload;
    const {
      sourceProfileId, newStoreName, newSlug, newEmail, cloneType,
      passwordStrategy, temporaryPassword, plan, options,
    } = payload;

    const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    if (!sourceProfileId || !newStoreName?.trim() || !newSlug || !newEmail || !cloneType) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!slugRegex.test(newSlug)) {
      return new Response(JSON.stringify({ error: "Slug inválido. Use letras minúsculas, números e hífens." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reserved slug check (mirrors front-end reservedSlugs list — short version)
    const reserved = new Set([
      "login","register","admin","master","dashboard","lojista","loja","lojas","api",
      "auth","onboarding","checkout","carrinho","cart","print","public","404","500",
    ]);
    if (reserved.has(newSlug)) {
      return new Response(JSON.stringify({ error: "Este slug é reservado pela plataforma." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Source profile
    const { data: sourceProfile, error: srcErr } = await admin
      .from("profiles").select("*").eq("id", sourceProfileId).maybeSingle();
    if (srcErr || !sourceProfile) {
      return new Response(JSON.stringify({ error: "Loja de origem não encontrada." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Slug uniqueness
    const { data: slugTaken } = await admin
      .from("profiles").select("id").eq("store_slug", newSlug).maybeSingle();
    if (slugTaken) {
      return new Response(JSON.stringify({ error: "Slug já está em uso." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare log row
    const { data: logRow } = await admin.from("store_clone_logs").insert({
      admin_user_id: adminUserId,
      source_profile_id: sourceProfileId,
      source_store_name: sourceProfile.store_name,
      cloned_store_name: newStoreName,
      cloned_store_slug: newSlug,
      cloned_email: newEmail,
      clone_type: cloneType,
      options: options as unknown as Record<string, unknown>,
      status: "in_progress",
    }).select("id").single();
    const logId = logRow?.id;

    const updateLog = async (patch: Record<string, unknown>) => {
      if (!logId) return;
      await admin.from("store_clone_logs").update(patch).eq("id", logId);
    };

    let newUserId: string | null = null;

    try {
      // 3) Create new auth user
      const createParams: Record<string, unknown> = {
        email: newEmail,
        email_confirm: true,
        user_metadata: {
          full_name: newStoreName,
          store_name: newStoreName,
          cloned_from: sourceProfileId,
        },
      };
      if (passwordStrategy === "temporary_password" && temporaryPassword) {
        createParams.password = temporaryPassword;
      } else {
        // create with a random unguessable password; user will set via reset link
        createParams.password = crypto.randomUUID() + crypto.randomUUID();
      }

      const { data: newUser, error: createErr } =
        await admin.auth.admin.createUser(createParams as never);
      if (createErr || !newUser?.user) {
        throw new Error(`Falha ao criar usuário: ${createErr?.message || "desconhecido"}`);
      }
      newUserId = newUser.user.id;

      // 4) Build cloned profile payload
      const profileClone: Record<string, unknown> = { ...sourceProfile };
      for (const k of PROFILE_EXCLUDED_FIELDS) delete profileClone[k];
      if (!options.copyAppearance) stripFields(profileClone, APPEARANCE_FIELDS);
      if (!options.copyBanners) stripFields(profileClone, BANNER_FIELDS);
      if (!options.copyPersonalization) stripFields(profileClone, PERSONALIZATION_FIELDS);

      const profileUpdate = {
        ...profileClone,
        store_name: newStoreName,
        store_slug: newSlug,
        email: newEmail,
        parent_account_id: sourceProfileId,
        is_cloned_store: true,
        cloned_from_profile_id: sourceProfileId,
        clone_type: cloneType,
        cloned_at: new Date().toISOString(),
        is_addon_store: true,
        addon_status: "active",
      };

      // handle_new_user already inserted a basic profile; UPDATE it.
      const { error: upErr } = await admin
        .from("profiles").update(profileUpdate).eq("id", newUserId);
      if (upErr) throw new Error(`Falha ao atualizar profile: ${upErr.message}`);

      // 5) Categories
      const categoryMap = new Map<string, string>();
      let categoriesCopied = 0;
      if (options.copyCategories) {
        const { data: cats } = await admin
          .from("product_categories").select("*").eq("user_id", sourceProfileId);
        for (const c of cats || []) {
          const { id: oldId, created_at, updated_at, ...rest } = c as Record<string, unknown>;
          const { data: ins, error } = await admin.from("product_categories")
            .insert({ ...rest, user_id: newUserId }).select("id").single();
          if (!error && ins) {
            categoryMap.set(oldId as string, ins.id);
            categoriesCopied++;
          }
        }
      }

      // 6) Brands
      const brandMap = new Map<string, string>();
      let brandsCopied = 0;
      if (options.copyBrands) {
        const { data: brands } = await admin
          .from("product_brands").select("*").eq("user_id", sourceProfileId);
        for (const b of brands || []) {
          const { id: oldId, created_at, updated_at, ...rest } = b as Record<string, unknown>;
          const { data: ins, error } = await admin.from("product_brands")
            .insert({ ...rest, user_id: newUserId }).select("id").single();
          if (!error && ins) {
            brandMap.set(oldId as string, ins.id);
            brandsCopied++;
          }
        }
      }

      // 7) Products + images
      let productsCopied = 0;
      let imagesCopied = 0;
      if (options.copyProducts) {
        const { data: prods } = await admin
          .from("products").select("*").eq("user_id", sourceProfileId);

        for (const p of prods || []) {
          const oldProductId = p.id as string;
          const {
            id, created_at, updated_at, views_count, sales_count, popularity_score,
            ...rest
          } = p as Record<string, unknown>;

          const newRow: Record<string, unknown> = {
            ...rest,
            user_id: newUserId,
            cloned_from_product_id: oldProductId,
            views_count: 0,
            sales_count: 0,
            popularity_score: 0,
          };
          if (rest.category_id && categoryMap.has(rest.category_id as string)) {
            newRow.category_id = categoryMap.get(rest.category_id as string);
          } else if (rest.category_id && !options.copyCategories) {
            newRow.category_id = null;
          }
          if (rest.brand_id && brandMap.has(rest.brand_id as string)) {
            newRow.brand_id = brandMap.get(rest.brand_id as string);
          } else if (rest.brand_id && !options.copyBrands) {
            newRow.brand_id = null;
          }

          const { data: insProd, error: prodErr } = await admin
            .from("products").insert(newRow).select("id").single();
          if (prodErr || !insProd) continue;
          productsCopied++;

          // Images for this product (URL-reference copy; documented fallback for MVP)
          if (options.copyImages) {
            const { data: imgs } = await admin
              .from("product_images").select("*").eq("product_id", oldProductId);
            for (const img of imgs || []) {
              const { id: imgId, ...imgRest } = img as Record<string, unknown>;
              const { error: imgErr } = await admin
                .from("product_images").insert({ ...imgRest, product_id: insProd.id });
              if (!imgErr) imagesCopied++;
            }
          }
        }
      }

      // 8) Shipping
      if (options.copyShipping) {
        const cloneSingleton = async (table: string) => {
          const { data } = await admin.from(table).select("*").eq("user_id", sourceProfileId);
          for (const row of data || []) {
            const { id, created_at, updated_at, ...rest } = row as Record<string, unknown>;
            await admin.from(table).insert({ ...rest, user_id: newUserId });
          }
        };
        await cloneSingleton("shipping_rules");
        await cloneSingleton("correios_settings");
        await cloneSingleton("melhor_envio_settings");
      }

      // 9) Coupons
      if (options.copyCoupons) {
        const { data } = await admin.from("coupons").select("*").eq("user_id", sourceProfileId);
        for (const row of data || []) {
          const { id, created_at, updated_at, ...rest } = row as Record<string, unknown>;
          await admin.from("coupons").insert({ ...rest, user_id: newUserId });
        }
      }

      // 10) Customer groups (definitions only, not assignments)
      if (options.copyCustomerGroups) {
        const { data } = await admin.from("customer_groups").select("*").eq("user_id", sourceProfileId);
        for (const row of data || []) {
          const { id, created_at, updated_at, ...rest } = row as Record<string, unknown>;
          await admin.from("customer_groups").insert({ ...rest, user_id: newUserId });
        }
      }

      // 11) Marketing settings
      if (options.copyMarketing) {
        const { data } = await admin.from("marketing_settings").select("*").eq("user_id", sourceProfileId);
        for (const row of data || []) {
          const { id, created_at, updated_at, domain_verification_code, domain_verified, ...rest } = row as Record<string, unknown>;
          await admin.from("marketing_settings").insert({ ...rest, user_id: newUserId });
        }
      }

      // 12) Payment settings (sensitive — only on explicit opt-in)
      if (options.copyPayments) {
        const { data } = await admin.from("payment_settings").select("*").eq("user_id", sourceProfileId);
        for (const row of data || []) {
          const { id, created_at, updated_at, ...rest } = row as Record<string, unknown>;
          await admin.from("payment_settings").insert({ ...rest, user_id: newUserId });
        }
      }

      // 13) Plan: assign same plan as source if requested.
      if (plan && plan !== "gratis") {
        let planId = plan;
        if (plan === "same") {
          const { data: srcSub } = await admin
            .from("master_subscriptions")
            .select("plan_id, billing_cycle, monthly_price, total_amount")
            .eq("user_id", sourceProfileId)
            .order("created_at", { ascending: false })
            .limit(1).maybeSingle();
          planId = (srcSub?.plan_id as string) || "gratis";
          if (planId !== "gratis") {
            await admin.from("master_subscriptions").insert({
              user_id: newUserId,
              plan_id: planId,
              status: "active",
              billing_cycle: srcSub?.billing_cycle || "monthly",
              monthly_price: srcSub?.monthly_price || 0,
              total_amount: srcSub?.total_amount || 0,
            });
          }
        } else {
          await admin.from("master_subscriptions").insert({
            user_id: newUserId,
            plan_id: planId,
            status: "active",
            billing_cycle: "monthly",
          });
        }
      }

      // 14) Password reset link (if requested)
      let resetLink: string | null = null;
      if (passwordStrategy === "reset_link") {
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: newEmail,
        });
        resetLink = (linkData as { properties?: { action_link?: string } })?.properties?.action_link ?? null;
      }

      await updateLog({
        cloned_profile_id: newUserId,
        products_copied: productsCopied,
        categories_copied: categoriesCopied,
        brands_copied: brandsCopied,
        images_copied: imagesCopied,
        status: "success",
      });

      return new Response(JSON.stringify({
        success: true,
        newStore: {
          userId: newUserId,
          email: newEmail,
          storeName: newStoreName,
          storeSlug: newSlug,
          publicUrl: `/${newSlug}`,
        },
        counts: {
          products: productsCopied,
          categories: categoriesCopied,
          brands: brandsCopied,
          images: imagesCopied,
        },
        resetLink,
        temporaryPassword: passwordStrategy === "temporary_password" ? temporaryPassword : null,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (cloneErr) {
      // Rollback: delete the partial new user (cascades profile via auth deletion)
      const msg = cloneErr instanceof Error ? cloneErr.message : String(cloneErr);
      if (newUserId) {
        try { await admin.auth.admin.deleteUser(newUserId); } catch (_) { /* ignore */ }
      }
      await updateLog({ status: "failed", error_message: msg });
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
