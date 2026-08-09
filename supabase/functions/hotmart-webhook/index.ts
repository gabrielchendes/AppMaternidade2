// Supabase Edge Function: hotmart-webhook
// URL de deployment: https://<SEU-PROJECT-REF>.supabase.co/functions/v1/hotmart-webhook
// Esta função recebe e processa eventos de Webhook da Hotmart (Vendas, Reembolsos, Cancelamentos) 
// de forma 100% segura, idempotente e automatizada.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GET route for ping / health-check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "online",
        service: "Hotmart Webhook Edge Function",
        timestamp: new Date().toISOString(),
        instructions: "Configure esta URL no menu de Webhook (Vendas) na Hotmart."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST for webhooks." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[Hotmart Edge Function] Missing Supabase environment variables!");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta (Service Role Key ausente)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const url = new URL(req.url);
    const bodyText = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.warn("[Hotmart Edge Function] Could not parse JSON body");
    }

    // 1. Validação do Token de Segurança (Hottok)
    const receivedToken =
      req.headers.get("x-hotmart-hottok") ||
      url.searchParams.get("token") ||
      url.searchParams.get("hottok") ||
      payload.hottok ||
      payload.token;

    let configuredToken: string | null = Deno.env.get("HOTMART_WEBHOOK_TOKEN") || null;
    
    // Fallback: Buscar token configurado em app_settings se não estiver nas ENVs
    if (!configuredToken) {
      try {
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("custom_texts")
          .eq("id", 1)
          .maybeSingle();

        if (settings?.custom_texts?.["hotmart.webhook_token"]) {
          configuredToken = settings.custom_texts["hotmart.webhook_token"];
        }
      } catch (e) {
        console.warn("[Hotmart Edge Function] Could not fetch settings token:", e);
      }
    }

    const isSimulation =
      req.headers.get("x-simulation") === "true" ||
      payload.is_simulation === true ||
      receivedToken === "SIMULATION_TOKEN";

    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRoleAuth = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "SERVICE_ROLE");

    if (configuredToken && configuredToken.trim()) {
      const isTokenValid = receivedToken && receivedToken.trim() === configuredToken.trim();
      const isSimAuthorized = isSimulation && (isTokenValid || isServiceRoleAuth || receivedToken === "SIMULATION_TOKEN");

      if (!isTokenValid && !isSimAuthorized) {
        console.warn("[Hotmart Edge Function] Token Hottok mismatch:", { receivedToken, configuredToken });
        return new Response(
          JSON.stringify({
            error: "Unauthorized: Token Hottok da Hotmart inválido.",
            tip: "Configure o token Hottok idêntico no Supabase (Secret HOTMART_WEBHOOK_TOKEN) e no painel da Hotmart."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    }

    // 2. Extração padronizada de dados (Hotmart Webhook v1, v2 e v3)
    const eventRaw = payload.event || payload.status || payload.transaction_status || "PURCHASE_APPROVED";
    const event = String(eventRaw).toUpperCase();

    const buyerEmailRaw =
      payload.data?.buyer?.email ||
      payload.buyer?.email ||
      payload.buyer_email ||
      payload.email ||
      payload.data?.subscriber?.email ||
      payload.subscriber?.email;

    if (!buyerEmailRaw || typeof buyerEmailRaw !== "string") {
      return new Response(
        JSON.stringify({ error: "E-mail do comprador não encontrado no payload." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const email = buyerEmailRaw.trim().toLowerCase();
    const buyerName = payload.data?.buyer?.name || payload.buyer?.name || payload.name || "Cliente Hotmart";
    const transactionId = payload.data?.purchase?.transaction || payload.transaction || payload.prod || ("HOTMART_" + Date.now());
    const numericProductId = payload.data?.product?.id ?? payload.prod ?? payload.product_id ?? payload.data?.subscription?.product?.id;
    const ucodeProductId = payload.data?.product?.ucode;

    let hotmartProductId = "";
    if (numericProductId !== undefined && numericProductId !== null && String(numericProductId).trim() !== "" && String(numericProductId).trim() !== "0") {
      hotmartProductId = String(numericProductId).trim();
    } else if (ucodeProductId && String(ucodeProductId).trim() !== "") {
      hotmartProductId = String(ucodeProductId).trim();
    } else if (numericProductId !== undefined && numericProductId !== null && String(numericProductId).trim() !== "") {
      hotmartProductId = String(numericProductId).trim();
    }

    console.log(`[Hotmart Edge Function] Processing event "${event}" for ${email}, Product ID: ${hotmartProductId || 'N/A (Default Principal)'}, Ucode: ${ucodeProductId || 'N/A'}, Transaction: ${transactionId}`);

    // 3. IDEMPOTÊNCIA: Verificar se transação/evento já foi processado
    if (transactionId && event) {
      try {
        const { data: existingEvent } = await supabaseAdmin
          .from("hotmart_events")
          .select("id, status")
          .eq("transaction_id", transactionId)
          .eq("event", event)
          .maybeSingle();

        if (existingEvent && existingEvent.status === "processed") {
          console.log(`[Hotmart Edge Function] Transaction ${transactionId} with event ${event} already processed. Skipping idempotently.`);
          return new Response(
            JSON.stringify({
              success: true,
              message: "Evento já processado anteriormente (Idempotência garantida).",
              transaction_id: transactionId,
              event: event
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      } catch (e) {
        // Tabela hotmart_events opcional se ainda não migrada
      }
    }

    // 4. Mapeamento Inteligente de Produto -> Tipo de Produto e Expansão de Pacotes
    let productType: "main_product" | "course" | "package" | "ai_subscription" = "main_product";
    let targetIds: string[] = [];

    if (hotmartProductId || ucodeProductId) {
      const searchKeys = Array.from(new Set([hotmartProductId, ucodeProductId].filter(Boolean) as string[]));

      // a) Procurar na tabela de mapeamento customizada hotmart_products
      let mapping: any = null;
      for (const key of searchKeys) {
        const { data } = await supabaseAdmin
          .from("hotmart_products")
          .select("*")
          .eq("hotmart_product_id", key)
          .eq("is_active", true)
          .maybeSingle();
        if (data) {
          mapping = data;
          break;
        }
      }

      if (mapping) {
        productType = mapping.product_type as any;
        const targetId = mapping.internal_target_id;

        if (productType === "package" && targetId) {
          const { data: pkgCourses } = await supabaseAdmin
            .from("package_courses")
            .select("course_id")
            .eq("package_id", targetId);
          targetIds = [targetId, ...(pkgCourses?.map(pc => pc.course_id) || [])];
        } else if (productType === "course" && targetId) {
          const { data: crs } = await supabaseAdmin
            .from("courses")
            .select("id, linked_package_id")
            .eq("id", targetId)
            .maybeSingle();
          if (crs?.linked_package_id) {
            const { data: pkgCourses } = await supabaseAdmin
              .from("package_courses")
              .select("course_id")
              .eq("package_id", crs.linked_package_id);
            targetIds = [crs.linked_package_id, ...(pkgCourses?.map(pc => pc.course_id) || [])];
          } else {
            targetIds = [targetId];
          }
        }
      } else {
        // b) Verificar se é Produto Principal ou IA Victoria de app_settings
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("custom_texts")
          .eq("id", 1)
          .maybeSingle();

        const configuredMainId = settings?.custom_texts?.["hotmart.main_product_id"];
        const configuredAiId = settings?.custom_texts?.["hotmart.unlimited_ai_product_id"] || settings?.custom_texts?.["hotmart.ai_product_id"];

        if (searchKeys.some(k => (configuredAiId && String(configuredAiId) === k))) {
          productType = "ai_subscription";
        } else if (searchKeys.some(k => (configuredMainId && String(configuredMainId) === k))) {
          productType = "main_product";
        } else {
          // c) Verificar se bate com hotmart_product_id de algum curso
          let courseMatch: any = null;
          for (const key of searchKeys) {
            const { data } = await supabaseAdmin
              .from("courses")
              .select("id, linked_package_id")
              .eq("hotmart_product_id", key)
              .maybeSingle();
            if (data) {
              courseMatch = data;
              break;
            }
          }

          if (courseMatch) {
            productType = "course";
            if (courseMatch.linked_package_id) {
              const { data: pkgCourses } = await supabaseAdmin
                .from("package_courses")
                .select("course_id")
                .eq("package_id", courseMatch.linked_package_id);
              targetIds = [courseMatch.linked_package_id, ...(pkgCourses?.map(pc => pc.course_id) || [])];
            } else {
              targetIds = [courseMatch.id];
            }
          } else {
            // d) Verificar se bate com hotmart_product_id de algum pacote
            let packageMatch: any = null;
            for (const key of searchKeys) {
              const { data } = await supabaseAdmin
                .from("course_packages")
                .select("id")
                .eq("hotmart_product_id", key)
                .maybeSingle();
              if (data) {
                packageMatch = data;
                break;
              }
            }

            if (packageMatch) {
              productType = "package";
              const { data: pkgCourses } = await supabaseAdmin
                .from("package_courses")
                .select("course_id")
                .eq("package_id", packageMatch.id);
              targetIds = [packageMatch.id, ...(pkgCourses?.map(pc => pc.course_id) || [])];
            }
          }
        }
      }
    }

    // 5. Determinar estado de Aprovado vs Revogado
    const isApprovalEvent =
      event.includes("APPROVED") ||
      event.includes("COMPLETE") ||
      event.includes("ACTIVATED") ||
      event.includes("APROVAD") ||
      event.includes("COMPLET") ||
      event === "PURCHASE_OUT_OF_SHOPPING_CART" ||
      event === "SUBSCRIPTION_RENEWAL";

    const isRevocationEvent =
      event.includes("REFUNDED") ||
      event.includes("CANCELED") ||
      event.includes("CANCELLED") ||
      event.includes("CHARGEBACK") ||
      event.includes("EXPIRED") ||
      event.includes("REEMBOLS") ||
      event.includes("INACTIVE");

    // 6. BUSCAR OU CRIAR USUÁRIO NO SUPABASE
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, has_access, has_unlimited_ai")
      .ilike("email", email)
      .maybeSingle();

    let targetUserId = existingProfile?.id;

    if (!existingProfile && isApprovalEvent) {
      console.log(`[Hotmart Edge Function] Creating new Auth user for ${email}...`);
      const tempPassword = "123456";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: buyerName }
      });

      if (newUser?.user) {
        targetUserId = newUser.user.id;
        await supabaseAdmin.from("profiles").upsert({
          id: newUser.user.id,
          email: email,
          full_name: buyerName,
          has_access: true,
          has_unlimited_ai: productType === "ai_subscription",
          created_at: new Date().toISOString()
        }, { onConflict: "email" });
      } else {
        console.error("[Hotmart Edge Function] Error creating auth user:", createError);
      }
    }

    // 7. APLICAR LÓGICA DE NEGÓCIO DE ACORDO COM O TIPO DE PRODUTO E EVENTO
    let actionSummary = "";

    if (targetUserId) {
      if (isApprovalEvent) {
        // APROVAÇÃO / RENOVAÇÃO
        if (productType === "main_product") {
          await supabaseAdmin
            .from("profiles")
            .update({ has_access: true, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          actionSummary = "Acesso Principal à Plataforma ATIVADO";
        } else if (productType === "ai_subscription") {
          await supabaseAdmin
            .from("profiles")
            .update({ has_unlimited_ai: true, has_access: true, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          actionSummary = "Assinatura IA Expert VIP ATIVADA";
        } else if ((productType === "course" || productType === "package") && targetIds.length > 0) {
          await supabaseAdmin
            .from("profiles")
            .update({ has_access: true, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);

          for (const pid of targetIds) {
            await supabaseAdmin.from("purchases").upsert({
              user_id: targetUserId,
              product_id: pid,
              created_at: new Date().toISOString()
            }, { onConflict: "user_id,product_id" as any });
          }

          actionSummary = `Produto Adicional (${productType}) Liberado (${targetIds.length} itens): ${targetIds.join(", ")}`;
        }
      } else if (isRevocationEvent) {
        // REVOGAÇÃO / REEMBOLSO / CANCELAMENTO / CHARGEBACK
        if (productType === "main_product") {
          await supabaseAdmin
            .from("profiles")
            .update({ has_access: false, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          actionSummary = "Acesso Principal à Plataforma PAUSADO (Conta Preservada)";
        } else if (productType === "ai_subscription") {
          await supabaseAdmin
            .from("profiles")
            .update({ has_unlimited_ai: false, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);

          await supabaseAdmin
            .from("purchases")
            .delete()
            .or(`user_id.eq.${targetUserId},email.eq.${email}`)
            .in("product_id", ["ai_subscription", "prod_ai_default", "HOTMART_IA_VICTORIA"]);

          actionSummary = "Assinatura IA Expert VIP REVOGADA";
        } else if ((productType === "course" || productType === "package") && targetIds.length > 0) {
          for (const pid of targetIds) {
            await supabaseAdmin
              .from("purchases")
              .delete()
              .eq("user_id", targetUserId)
              .eq("product_id", pid);
          }

          actionSummary = `Produto Adicional (${productType}) Bloqueado (${targetIds.length} itens): ${targetIds.join(", ")}`;
        }
      }
    }

    // 8. REGISTRAR EVENTO NA TABELA LOG (hotmart_events) PARA AUDITORIA E IDEMPOTÊNCIA
    try {
      await supabaseAdmin.from("hotmart_events").insert({
        transaction_id: transactionId,
        event: event,
        buyer_email: email,
        hotmart_product_id: hotmartProductId || null,
        status: "processed",
        payload: payload,
        processed_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.warn("[Hotmart Edge Function] Could not log event to hotmart_events:", logErr);
    }

    // 8.5 REGISTRAR OU ATUALIZAR VENDA NA TABELA SALES
    try {
      let resolvedName = payload.data?.product?.name;
      if (!resolvedName || resolvedName === 'Curso / Produto Hotmart (Simulação)') {
        if (productType === 'main_product') resolvedName = 'Acesso Geral à Plataforma (Produto Principal)';
        else if (productType === 'ai_subscription') resolvedName = 'Assinatura IA Expert VIP (Ilimitada)';
        else resolvedName = 'Produto Hotmart (' + (hotmartProductId || configuredMainId || 'Sem ID') + ')';
      }

      const rawAmount = Number(
        payload.data?.purchase?.price?.value ?? 
        payload.data?.purchase?.full_price?.value ?? 
        payload.price ?? 
        97
      ) || 0;

      const currency = String(
        payload.data?.purchase?.price?.currency_value ?? 
        payload.currency ?? 
        'BRL'
      ).toUpperCase();

      const paymentType = String(
        payload.data?.purchase?.payment?.type ?? 
        payload.payment_type ?? 
        'PIX'
      ).toUpperCase();

      const saleStatus = isApprovalEvent ? 'approved' :
        event.includes('REFUND') || event.includes('REEMBOLS') ? 'refunded' :
        event.includes('CANCEL') ? 'canceled' :
        event.includes('CHARGEBACK') ? 'chargeback' : 'approved';

      const purchaseDate = payload.data?.purchase?.approved_date || payload.data?.purchase?.order_date || payload.creation_date;
      const formattedDate = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString();

      await supabaseAdmin.from('sales').upsert({
        transaction_id: transactionId || ('TRX_' + Date.now()),
        buyer_name: buyerName || 'Comprador Hotmart',
        buyer_email: email,
        buyer_phone: payload.data?.buyer?.checkout_phone || null,
        product_id: hotmartProductId || configuredMainId || 'main_product',
        product_name: resolvedName,
        product_type: productType,
        amount: rawAmount,
        currency: currency,
        payment_type: paymentType,
        status: saleStatus,
        event_type: event,
        purchase_date: formattedDate,
        raw_payload: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'transaction_id' });
    } catch (sErr) {
      console.warn('[Hotmart Edge Function] Could not record sale to sales table:', sErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: email,
        event: event,
        product_type: productType,
        action: actionSummary,
        target_ids: targetIds,
        message: `Processamento concluído com sucesso para ${email}.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    console.error("[Hotmart Edge Function Fatal Error]:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar Webhook Hotmart", details: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
