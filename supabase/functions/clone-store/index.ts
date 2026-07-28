// Edge function: clone-store
// Duplica uma loja existente criando uma NOVA conta-loja independente.
// Apenas administradores podem invocar.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key, x-request-id, x-supabase-api-version, accept",
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
  requestId?: string;
  options: CloneOptions;
}

const CLONE_STORE_FULL_DATA_V2_FLAG = "clone_store_full_data_v2";
const CLONE_BATCH_SIZE = 50;
const CLONE_PLAN_LIMIT_REASON = "clone_pending_plan_limit";

type DbClient = ReturnType<typeof createClient>;

type SourceProduct = Record<string, unknown> & {
  id: string;
  is_active?: boolean;
  created_at?: string;
};

type ProductCloneMapEntry = {
  sourceProductId: string;
  clonedProductId: string;
  sourceWasActive: boolean;
  sourceCreatedAt: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

function parseBooleanFlag(value: unknown): boolean {
  return ["true", "1", "enabled", "on", "yes", "sim"].includes(String(value ?? "").trim().toLowerCase());
}

async function isFullCloneV2Enabled(admin: DbClient): Promise<boolean> {
  const { data, error } = await admin
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", CLONE_STORE_FULL_DATA_V2_FLAG)
    .maybeSingle();

  if (error) {
    console.warn("[clone-store] feature flag read failed", { flag: CLONE_STORE_FULL_DATA_V2_FLAG, message: error.message });
    return true;
  }

  if (!data) return true;
  return parseBooleanFlag((data as { setting_value?: unknown } | null)?.setting_value);
}

function getPlanActiveLimit(planId: string | null | undefined): number | null {
  const normalized = String(planId || "gratis").trim().toLowerCase();
  if (normalized === "premium") return null;
  if (normalized === "pro") return 150;
  return 20;
}

function sortSourceProducts(products: SourceProduct[]) {
  return [...products].sort((a, b) => {
    const aa = a.is_active === true ? 0 : 1;
    const bb = b.is_active === true ? 0 : 1;
    if (aa !== bb) return aa - bb;
    const ac = String(a.created_at ?? "");
    const bc = String(b.created_at ?? "");
    if (ac !== bc) return ac < bc ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

async function fetchAllRows(
  admin: DbClient,
  table: string,
  column: string,
  value: string,
) {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq(column, value)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`);
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchProductImagesBySourceProduct(admin: DbClient, sourceProductIds: string[]) {
  const imageMap = new Map<string, Record<string, unknown>[]>();
  if (sourceProductIds.length === 0) return imageMap;

  for (let i = 0; i < sourceProductIds.length; i += 100) {
    const chunk = sourceProductIds.slice(i, i + 100);
    const { data, error } = await admin
      .from("product_images")
      .select("*")
      .in("product_id", chunk);
    if (error) throw new Error(`Falha ao ler imagens dos produtos: ${error.message}`);
    for (const img of (data || []) as Record<string, unknown>[]) {
      const sourceProductId = String(img.product_id || "");
      const list = imageMap.get(sourceProductId) || [];
      list.push(img);
      imageMap.set(sourceProductId, list);
    }
  }

  return imageMap;
}

Deno.serve(async (req) => {
  const headerRequestId = req.headers.get("x-request-id") || crypto.randomUUID();
  console.log("[clone-store] request received", { requestId: headerRequestId, method: req.method });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({
        success: false,
        code: "UNAUTHORIZED",
        message: "Sessão administrativa inválida ou expirada.",
        error: "Sessão administrativa inválida ou expirada.",
        requestId: headerRequestId,
      }, 401);
    }

    if (req.method !== "POST") {
      return jsonResponse({
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Método não permitido.",
        error: "Método não permitido.",
        requestId: headerRequestId,
      }, 405);
    }

    console.log("[clone-store] auth header present", { requestId: headerRequestId });

    // 1) Validate caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      console.warn("[clone-store] claims validation failed", {
        requestId: headerRequestId,
        message: claimsError?.message,
      });
      return jsonResponse({
        success: false,
        code: "UNAUTHORIZED",
        message: "Sessão administrativa inválida ou expirada.",
        error: "Sessão administrativa inválida ou expirada.",
        requestId: headerRequestId,
      }, 401);
    }
    const adminUserId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: adminUserId, _role: "admin",
    });
    if (!isAdmin) {
      console.warn("[clone-store] forbidden non-admin", { requestId: headerRequestId, adminUserId });
      return jsonResponse({
        success: false,
        code: "FORBIDDEN",
        message: "Usuário sem permissão para duplicar lojas.",
        error: "Usuário sem permissão para duplicar lojas.",
        requestId: headerRequestId,
      }, 403);
    }

    // 2) Validate payload
    const payload = (await req.json()) as ClonePayload;
    const requestId = String(payload.requestId || headerRequestId);
    if (payload.requestId && payload.requestId !== headerRequestId) {
      console.warn("[clone-store] request id mismatch", {
        requestId,
        headerRequestId,
        bodyRequestId: payload.requestId,
      });
    }
    const {
      sourceProfileId, newStoreName, newSlug, newEmail, cloneType,
      passwordStrategy, temporaryPassword, plan, options,
    } = payload;

    console.log("[clone-store] payload received", {
      requestId,
      functionName: "clone-store",
      sourceProfileId,
      newSlug,
      newEmail,
      cloneType,
      plan,
      passwordStrategy,
      optionKeys: options ? Object.keys(options) : [],
    });

    const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    if (!sourceProfileId || !newStoreName?.trim() || !newSlug || !newEmail || !cloneType) {
      return jsonResponse({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Campos obrigatórios ausentes.",
        error: "Campos obrigatórios ausentes.",
        requestId,
      }, 400);
    }
    if (!slugRegex.test(newSlug)) {
      return jsonResponse({
        success: false,
        code: "INVALID_SLUG",
        message: "Slug inválido. Use letras minúsculas, números e hífens.",
        error: "Slug inválido. Use letras minúsculas, números e hífens.",
        requestId,
      }, 400);
    }

    // Reserved slug check (mirrors front-end reservedSlugs list — short version)
    const reserved = new Set([
      "login","register","admin","master","dashboard","lojista","loja","lojas","api",
      "auth","onboarding","checkout","carrinho","cart","print","public","404","500",
    ]);
    if (reserved.has(newSlug)) {
      return jsonResponse({
        success: false,
        code: "RESERVED_SLUG",
        message: "Este slug é reservado pela plataforma.",
        error: "Este slug é reservado pela plataforma.",
        requestId,
      }, 400);
    }

    // Source profile
    const { data: sourceProfile, error: srcErr } = await admin
      .from("profiles").select("*").eq("id", sourceProfileId).maybeSingle();
    if (srcErr || !sourceProfile) {
      return jsonResponse({
        success: false,
        code: "SOURCE_STORE_NOT_FOUND",
        message: "Loja de origem não encontrada.",
        error: "Loja de origem não encontrada.",
        requestId,
      }, 404);
    }

    // Slug uniqueness
    const { data: slugTaken } = await admin
      .from("profiles").select("id").eq("store_slug", newSlug).maybeSingle();
    if (slugTaken) {
      return jsonResponse({
        success: false,
        code: "SLUG_ALREADY_EXISTS",
        message: "Slug já está em uso.",
        error: "Slug já está em uso.",
        requestId,
      }, 409);
    }

    // Email uniqueness (auth.users) — pre-check to return a friendly error
    // instead of failing later inside createUser().
    try {
      const { data: existing } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const emailLower = newEmail.trim().toLowerCase();
      const clash = existing?.users?.find(
        (u) => (u.email || "").toLowerCase() === emailLower,
      );
      if (clash) {
        return jsonResponse({
          success: false,
          code: "EMAIL_ALREADY_EXISTS",
          message: "Este e-mail já está cadastrado na plataforma. Use um e-mail diferente para a loja duplicada.",
          error: "Este e-mail já está cadastrado na plataforma. Use um e-mail diferente para a loja duplicada.",
          requestId,
        }, 409);
      }
    } catch (_) {
      // If the listing fails we fall through — createUser() will still catch dup emails.
    }

    // Idempotency: if header present and a successful log exists, return prior result.
    const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("x-idempotency-key");
    if (idempotencyKey) {
      const { data: prior } = await admin
        .from("store_clone_logs")
        .select("id, status, cloned_profile_id, cloned_store_slug, cloned_email, cloned_store_name, request_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (prior) {
        console.log("[clone-store] idempotency hit", {
          requestId,
          priorRequestId: prior.request_id,
          logId: prior.id,
          status: prior.status,
        });
      }
      if (prior && prior.status === "success") {
        return jsonResponse({
          success: true,
          requestId,
          idempotent: true,
          newStore: {
            userId: prior.cloned_profile_id,
            email: prior.cloned_email,
            storeName: prior.cloned_store_name,
            storeSlug: prior.cloned_store_slug,
            publicUrl: `/${prior.cloned_store_slug}`,
          },
        }, 200);
      }
      if (prior && prior.status === "in_progress") {
        return jsonResponse({
          success: true,
          requestId,
          idempotent: true,
          async: true,
          logId: prior.id,
          message: "Clonagem já em andamento. Aguardando conclusão...",
        }, 202);
      }
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
      request_id: requestId,
      clone_phase: "queued",
      idempotency_key: idempotencyKey,
    }).select("id").single();
    const logId = logRow?.id;

    if (!logId) {
      return jsonResponse({
        success: false,
        code: "LOG_CREATE_FAILED",
        message: "Não foi possível iniciar o registro da duplicação.",
        error: "Não foi possível iniciar o registro da duplicação.",
        requestId,
      }, 500);
    }

    console.log("[clone-store] log created", { requestId, logId });

    const updateLog = async (patch: Record<string, unknown>) => {
      if (!logId) return;
      await admin.from("store_clone_logs").update(patch).eq("id", logId);
    };

    const fullDataV2Enabled = await isFullCloneV2Enabled(admin);
    console.log("[clone-store] feature flag resolved", {
      requestId,
      logId,
      flag: CLONE_STORE_FULL_DATA_V2_FLAG,
      enabled: fullDataV2Enabled,
    });

    // Kick off the heavy clone work in the background so the client
    // doesn't hit proxy/fetch timeouts on large stores. The modal polls
    // `store_clone_logs` by `logId` until status !== 'in_progress'.
    const runClone = async () => {
      let newUserId: string | null = null;
      try {
        console.log("[clone-store] background clone started", { requestId, logId });
        await updateLog({ clone_phase: "creating_owner" });

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
      await updateLog({ clone_phase: "creating_store" });
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
      await updateLog({ clone_phase: "copying_categories" });
      const categoryMap = new Map<string, string>();
      let categoriesCopied = 0;
      let sourceCategoriesTotal = 0;
      if (options.copyCategories) {
        const { data: cats } = await admin
          .from("product_categories").select("*").eq("user_id", sourceProfileId);
        sourceCategoriesTotal = (cats || []).length;
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
      await updateLog({ clone_phase: "copying_brands" });
      const brandMap = new Map<string, string>();
      let brandsCopied = 0;
      let sourceBrandsTotal = 0;
      if (options.copyBrands) {
        const { data: brands } = await admin
          .from("product_brands").select("*").eq("user_id", sourceProfileId);
        sourceBrandsTotal = (brands || []).length;
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

      // 6.5) Assinatura: criar ANTES dos produtos.
      // Para planos pagos ("same" com origem paga, ou plano pago escolhido),
      // a assinatura nasce em plano Grátis com pending_plan_id preenchido,
      // status='pending_payment'. Os benefícios do plano pago só serão liberados
      // pelo webhook após confirmação do pagamento.
      let pendingPlanId: string | null = null;
      let sourcePlanId = "gratis";
      let intendedPlanId = plan === "same" ? "gratis" : (plan || "gratis");
      const { data: sourceSubscription } = await admin
        .from("master_subscriptions")
        .select("plan_id, billing_cycle, monthly_price, total_amount")
        .eq("user_id", sourceProfileId)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      sourcePlanId = String(sourceSubscription?.plan_id || "gratis").toLowerCase();
      if (plan === "same") intendedPlanId = sourcePlanId;

      await updateLog({ clone_phase: "configuring_subscription" });
      if (plan && plan !== "gratis") {
        let targetPlan = plan as string;
        let cycle: string | null = null;
        let monthly = 0;
        let total = 0;
        if (plan === "same") {
          targetPlan = sourcePlanId;
          cycle = (sourceSubscription?.billing_cycle as string) || "monthly";
          monthly = Number(sourceSubscription?.monthly_price ?? 0);
          total = Number(sourceSubscription?.total_amount ?? 0);
        } else {
          cycle = "monthly";
        }
        if (targetPlan && targetPlan !== "gratis") {
          pendingPlanId = targetPlan;
          await admin.from("master_subscriptions").insert({
            user_id: newUserId,
            plan_id: "gratis",
            pending_plan_id: targetPlan,
            source_profile_id: sourceProfileId,
            source_plan_id: sourcePlanId,
            status: "pending_payment",
            billing_cycle: cycle,
            monthly_price: monthly,
            total_amount: total,
          });
        }
      }

      // 7) Products + images
      // V2 separates full data copy from plan entitlement. The clone routine never
      // limits how many products are copied; it only decides the provisional
      // `is_active` state using the current entitlement (free until payment).
      let productsCopied = 0;
      let imagesCopied = 0;
      let productsDeactivatedByPlan = 0;
      const LIMIT_MARK = "limite de produtos ativos";
      let sourceProductsCount = 0;
      let clonedProductsCount = 0;
      let sourceCategoriesCount = options.copyCategories ? sourceCategoriesTotal : 0;
      let clonedCategoriesCount = options.copyCategories ? categoriesCopied : 0;
      let sourceBrandsCount = options.copyBrands ? sourceBrandsTotal : 0;
      let clonedBrandsCount = options.copyBrands ? brandsCopied : 0;
      let sourceImagesCount = 0;
      let clonedImagesCount = 0;

      if (options.copyProducts) {
        await updateLog({ clone_phase: "copying_products" });
        const prods = (await fetchAllRows(admin, "products", "user_id", sourceProfileId)) as SourceProduct[];
        const sortedProds = sortSourceProducts(prods);
        sourceProductsCount = sortedProds.length;
        await updateLog({
          source_products_count: sourceProductsCount,
          clone_batch_size: CLONE_BATCH_SIZE,
          integrity_report: {
            sourceProductsCount,
            stage: "products_read",
            fullDataV2Enabled,
          },
        });

        if (fullDataV2Enabled) {
          const sourceProductIds = sortedProds.map((p) => p.id);
          const sourceImagesByProduct = options.copyImages
            ? await fetchProductImagesBySourceProduct(admin, sourceProductIds)
            : new Map<string, Record<string, unknown>[]>();
          sourceImagesCount = Array.from(sourceImagesByProduct.values()).reduce((sum, rows) => sum + rows.length, 0);
          const activeLimit = getPlanActiveLimit("gratis");
          let activeAssigned = 0;
          let batchNumber = 0;
          const productMap: ProductCloneMapEntry[] = [];

          for (let offset = 0; offset < sortedProds.length; offset += CLONE_BATCH_SIZE) {
            batchNumber++;
            const batch = sortedProds.slice(offset, offset + CLONE_BATCH_SIZE);
            let batchInserted = 0;
            let batchRead = batch.length;
            const batchErrors: string[] = [];

            for (const p of batch) {
              const oldProductId = p.id;
              const wasActive = p.is_active === true;
              const {
                id, created_at, updated_at, views_count, sales_count, popularity_score,
                ...rest
              } = p as Record<string, unknown>;

              const keepActive = wasActive && (activeLimit === null || activeAssigned < activeLimit);
              const newRow: Record<string, unknown> = {
                ...rest,
                user_id: newUserId,
                cloned_from_product_id: oldProductId,
                clone_job_id: logId,
                is_active: keepActive,
                inactive_reason: keepActive
                  ? null
                  : (wasActive ? CLONE_PLAN_LIMIT_REASON : (rest.inactive_reason || "manual")),
                was_active_before_plan_restriction: wasActive && !keepActive,
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

              let clonedProductId: string | null = null;
              const { data: existingProduct } = await admin
                .from("products")
                .select("id")
                .eq("user_id", newUserId)
                .eq("cloned_from_product_id", oldProductId)
                .maybeSingle();

              if (existingProduct?.id) {
                clonedProductId = existingProduct.id as string;
              } else {
                const { data: insProd, error: prodErr } = await admin
                  .from("products").insert(newRow).select("id").single();
                if (prodErr || !insProd) {
                  const errMsg = `${oldProductId}: ${prodErr?.message || "insert sem retorno"}`;
                  batchErrors.push(errMsg);
                  console.error("[clone-store] product insert failed", { requestId, logId, oldProductId, message: prodErr?.message });
                  continue;
                }
                clonedProductId = insProd.id as string;
                batchInserted++;
                if (keepActive) activeAssigned++;
                if (!keepActive && wasActive) productsDeactivatedByPlan++;
              }

              productsCopied++;
              productMap.push({
                sourceProductId: oldProductId,
                clonedProductId,
                sourceWasActive: wasActive,
                sourceCreatedAt: String(p.created_at || ""),
              });

              if (options.copyImages) {
                const sourceImages = sourceImagesByProduct.get(oldProductId) || [];
                if (sourceImages.length > 0) {
                  const { count: existingImageCount } = await admin
                    .from("product_images")
                    .select("id", { count: "exact", head: true })
                    .eq("product_id", clonedProductId);
                  if ((existingImageCount || 0) === 0) {
                    if (imagesCopied === 0) await updateLog({ clone_phase: "copying_images" });
                    for (const img of sourceImages) {
                      const { id: imgId, ...imgRest } = img;
                      const { error: imgErr } = await admin
                        .from("product_images")
                        .insert({ ...imgRest, product_id: clonedProductId });
                      if (!imgErr) imagesCopied++;
                      else console.error("[clone-store] image insert failed", { requestId, logId, oldProductId, message: imgErr.message });
                    }
                  }
                }
              }
            }

            await updateLog({
              clone_phase: "copying_products",
              products_copied: productsCopied,
              products_deactivated_by_plan: productsDeactivatedByPlan,
              images_copied: imagesCopied,
              clone_batches_processed: batchNumber,
              clone_last_product_cursor: batch[batch.length - 1]?.id || null,
              integrity_report: {
                sourceProductsCount,
                productsAttempted: Math.min(offset + batchRead, sourceProductsCount),
                productsCopied,
                productsDeactivatedByPlan,
                imagesCopied,
                lastBatch: {
                  batchNumber,
                  read: batchRead,
                  inserted: batchInserted,
                  errors: batchErrors.slice(0, 20),
                },
                productMapCount: productMap.length,
                fullDataV2Enabled,
              },
            });
          }
        } else {
        for (const p of sortedProds) {
          const oldProductId = p.id as string;
          const wasActive = (p as { is_active?: boolean }).is_active === true;
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

          let { data: insProd, error: prodErr } = await admin
            .from("products").insert(newRow).select("id").single();

          // Handle "plan limit" exception → retry as inactive (was_active_before_plan_restriction preserved).
          if (prodErr && wasActive && String(prodErr.message || "").toLowerCase().includes(LIMIT_MARK)) {
            const retryRow = {
              ...newRow,
              is_active: false,
              inactive_reason: CLONE_PLAN_LIMIT_REASON,
              was_active_before_plan_restriction: true,
              clone_job_id: logId,
            };
            const retry = await admin
              .from("products").insert(retryRow).select("id").single();
            insProd = retry.data ?? null;
            prodErr = retry.error;
            if (!prodErr && insProd) productsDeactivatedByPlan++;
          }

          if (prodErr || !insProd) {
            if (prodErr) {
              // Log real error for diagnostics instead of silent drop.
              console.error("[clone-store] product insert failed", oldProductId, prodErr.message);
            }
            continue;
          }
          productsCopied++;

          // Images for this product (URL-reference copy)
          if (options.copyImages) {
            if (imagesCopied === 0) await updateLog({ clone_phase: "copying_images" });
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
      }

      if (fullDataV2Enabled) {
        const { data: clonedProductIdsData } = await admin
          .from("products")
          .select("id")
          .eq("user_id", newUserId)
          .not("cloned_from_product_id", "is", null);
        const clonedProductIds = (clonedProductIdsData || []).map((row) => row.id as string);
        const [sourceProductCountResult, clonedProductCountResult, clonedImageCountResult] = await Promise.all([
          admin.from("products").select("id", { count: "exact", head: true }).eq("user_id", sourceProfileId),
          admin.from("products").select("id", { count: "exact", head: true }).eq("user_id", newUserId).not("cloned_from_product_id", "is", null),
          options.copyImages
            ? (clonedProductIds.length > 0
              ? admin.from("product_images").select("id", { count: "exact", head: true }).in("product_id", clonedProductIds)
              : Promise.resolve({ count: 0 }))
            : Promise.resolve({ count: 0 }),
        ]);
        sourceProductsCount = sourceProductCountResult.count ?? sourceProductsCount;
        clonedProductsCount = clonedProductCountResult.count ?? productsCopied;
        clonedImagesCount = clonedImageCountResult.count ?? imagesCopied;

        const integrityReport = {
          sourceProductsCount,
          clonedProductsCount,
          sourceCategoriesCount,
          clonedCategoriesCount,
          sourceBrandsCount,
          clonedBrandsCount,
          sourceImagesCount,
          clonedImagesCount,
          productsDeactivatedByPlan,
          fullDataV2Enabled,
        };
        const integrityFailures: string[] = [];
        if (sourceProductsCount !== clonedProductsCount) integrityFailures.push(`products ${clonedProductsCount}/${sourceProductsCount}`);
        if (sourceCategoriesCount !== clonedCategoriesCount) integrityFailures.push(`categories ${clonedCategoriesCount}/${sourceCategoriesCount}`);
        if (sourceBrandsCount !== clonedBrandsCount) integrityFailures.push(`brands ${clonedBrandsCount}/${sourceBrandsCount}`);
        if (sourceImagesCount !== clonedImagesCount) integrityFailures.push(`images ${clonedImagesCount}/${sourceImagesCount}`);

        if (integrityFailures.length > 0) {
          const errorMessage = `Falha de integridade na clonagem: ${integrityFailures.join(", ")}`;
          await updateLog({
            cloned_profile_id: newUserId,
            source_products_count: sourceProductsCount,
            cloned_products_count: clonedProductsCount,
            source_categories_count: sourceCategoriesCount,
            cloned_categories_count: clonedCategoriesCount,
            source_brands_count: sourceBrandsCount,
            cloned_brands_count: clonedBrandsCount,
            source_images_count: sourceImagesCount,
            cloned_images_count: clonedImagesCount,
            integrity_report: integrityReport,
            status: "failed_integrity_check",
            clone_phase: "failed_integrity_check",
            error_message: errorMessage,
          });
          try { await admin.auth.admin.deleteUser(newUserId); } catch (_) { /* ignore */ }
          console.error("[clone-store] integrity check failed", { requestId, logId, integrityReport });
          return;
        }
      } else {
        clonedProductsCount = productsCopied;
        clonedImagesCount = imagesCopied;
      }

      // 8) Shipping
      await updateLog({ clone_phase: "copying_settings" });
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

      // 12) Payment settings: NUNCA copiar credenciais/segredos entre lojas
      // (mesmo com opt-in). A opção legada `copyPayments` é ignorada aqui —
      // qualquer credencial (tokens, webhooks, chaves) deve ser reconfigurada
      // manualmente na nova loja para evitar cobrança cruzada e vazamentos.
      // A assinatura da nova loja já foi criada no passo 6.5 com pending_plan_id.

      // 14) Password reset link (if requested)
      await updateLog({ clone_phase: "finalizing" });
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
        products_deactivated_by_plan: productsDeactivatedByPlan,
        pending_plan_id: pendingPlanId,
        subscription_status: pendingPlanId ? "pending_payment" : "active",
        reset_link: resetLink,
        temporary_password: passwordStrategy === "temporary_password" ? temporaryPassword : null,
        status: "success",
        clone_phase: "completed",
      });
      console.log("[clone-store] background clone completed", {
        requestId,
        logId,
        productsCopied,
        imagesCopied,
        categoriesCopied,
        brandsCopied,
      });
      } catch (cloneErr) {
        // Rollback: delete the partial new user (cascades profile via auth deletion)
        const msg = cloneErr instanceof Error ? cloneErr.message : String(cloneErr);
        if (newUserId) {
          try { await admin.auth.admin.deleteUser(newUserId); } catch (_) { /* ignore */ }
        }
        console.error("[clone-store] background clone failed", { requestId, logId, message: msg });
        await updateLog({ status: "failed", clone_phase: "failed", error_message: msg });
      }
    };

    // Run in background: return 202 immediately so the browser doesn't
    // timeout on long clones. Client polls store_clone_logs by logId.
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(runClone());
    } else {
      // Fallback (local dev): fire-and-forget.
      runClone();
    }

    console.log("[clone-store] returning 202", { requestId, logId });

    return jsonResponse({
      success: true,
      requestId,
      async: true,
      logId,
      message: "Clonagem iniciada. Aguardando conclusão...",
    }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[clone-store] request failed before 202", {
      requestId: headerRequestId,
      message: msg,
    });
    return jsonResponse({
      success: false,
      code: "INTERNAL_ERROR",
      message: msg,
      error: msg,
      requestId: headerRequestId,
    }, 500);
  }
});

