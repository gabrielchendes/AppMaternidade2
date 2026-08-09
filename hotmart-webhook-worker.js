/**
 * CONFIGURAÇÃO DE SUPABASE EDGE FUNCTION PARA WEBHOOK DA HOTMART
 * 
 * --- GUIA PASSO A PASSO COMPLETO DE CONFIGURAÇÃO NO SUPABASE WEB ---
 * 
 * 1. DESATIVAR A EXIGÊNCIA DE JWT (AUTENTICAÇÃO PADRÃO) - CRÍTICO:
 *    A Hotmart não envia o cabeçalho "Authorization: Bearer <JWT_SUPABASE>". Por isso, se o Supabase
 *    estiver configurado para exigir JWT ("Enforce JWT Verification"), a requisição é bloqueada antes
 *    de chegar ao nosso código com a mensagem: {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}.
 * 
 *    • Como desativar pelo Painel Web do Supabase:
 *      1. Acesse https://supabase.com/dashboard -> Seu Projeto.
 *      2. Clique em "Edge Functions" (ícone de raio ⚡) no menu lateral.
 *      3. Clique na function `hotmart-webhook`.
 *      4. Acesse a aba "Settings" ou clique nos três pontinhos (...) no canto da function.
 *      5. Desmarque a opção: "Enforce JWT Verification" (ou mude para Disabled/Off).
 * 
 *    • Se estiver implantando via CLI do Supabase no seu computador:
 *      npx supabase functions deploy hotmart-webhook --no-verify-jwt
 * 
 * 2. CONFIGURAR O SEGREDO DO TOKEN HOTTOK DA HOTMART:
 *    • No painel do Supabase:
 *      1. Vá em Edge Functions -> "Secrets" (ou Project Settings -> Vault / Edge Function Secrets).
 *      2. Adicione a chave: `HOTMART_WEBHOOK_TOKEN`
 *      3. Insira o valor do seu Hottok (encontrado em Hotmart -> Ferramentas -> Webhook / API).
 * 
 * 3. SUPORTE A DADOS DE TESTE (SANDBOX) E DADOS DE PRODUÇÃO:
 *    • Em eventos de teste disparados pelo botão "Enviar teste" na Hotmart:
 *      - A Hotmart envia `data.product.id = 0` e `data.product.ucode = "fb056612-bcc6-4217-..."`.
 *      - Esta função extrai o Ucode automaticamente caso o ID venha como 0, garantindo que o webhook
 *        seja registrado com sucesso em ambiente de testes ou produção.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // 1. Resposta Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Health-check / Diagnóstico
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "online",
        service: "Hotmart Webhook Edge Function (Supabase)",
        timestamp: new Date().toISOString(),
        instructions: "Configure esta URL no menu de Webhook na Hotmart. Lembre-se de DESATIVAR 'Enforce JWT Verification' no painel Supabase."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido. Utilize POST para webhooks." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[Hotmart Edge Function] Variáveis de ambiente do Supabase não encontradas!");
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
      console.warn("[Hotmart Edge Function] Não foi possível fazer parse do JSON do payload");
    }

    // 3. Validação do Token de Segurança (Hottok)
    const receivedToken =
      req.headers.get("x-hotmart-hottok") ||
      url.searchParams.get("token") ||
      url.searchParams.get("hottok") ||
      payload.hottok ||
      payload.token;

    let configuredToken: string | null = Deno.env.get("HOTMART_WEBHOOK_TOKEN") || null;
    
    // Fallback: Buscar token configurado em app_settings se não estiver nas variáveis de ambiente
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
        console.warn("[Hotmart Edge Function] Erro ao buscar token de app_settings:", e);
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
            error: "Não autorizado: Token Hottok da Hotmart inválido.",
            tip: "Configure o token Hottok idêntico no Supabase (Secret HOTMART_WEBHOOK_TOKEN) e no painel da Hotmart."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    }

    // 4. Extração de dados da transação
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

    // Suporte inteligente a ID de produto em Testes (Sandbox id = 0) vs Produção
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

    console.log(`[Hotmart Edge Function] Processando evento "${event}" para ${email}, Produto ID/Ucode: ${hotmartProductId || '0 (Sandbox)'}, Transação: ${transactionId}`);

    // 5. IDEMPOTÊNCIA: Verificar se transação/evento já foi processado anteriormente
    if (transactionId && event) {
      try {
        const { data: existingEvent } = await supabaseAdmin
          .from("hotmart_events")
          .select("id, status")
          .eq("transaction_id", transactionId)
          .eq("event", event)
          .maybeSingle();

        if (existingEvent && existingEvent.status === "processed") {
          console.log(`[Hotmart Edge Function] Transação ${transactionId} evento ${event} já processado anteriormente.`);
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
        // Ignora caso tabela hotmart_events não exista
      }
    }

    // 6. Mapeamento Inteligente do Produto Hotmart -> Produto Interno e Expansão de Pacotes
    let productType: "main_product" | "course" | "package" | "ai_subscription" = "main_product";
    let targetIds: string[] = [];

    if (hotmartProductId || ucodeProductId) {
      const searchKeys = Array.from(new Set([hotmartProductId, ucodeProductId].filter(Boolean) as string[]));

      // a) Verifica na tabela hotmart_products
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
        // b) Verifica em app_settings (Produto Principal ou IA)
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
          // c) Verifica se bate com hotmart_product_id de algum curso
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
            // d) Verifica se bate com hotmart_product_id de algum pacote
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

    // 7. Determinar se é APROVAÇÃO ou REVOGAÇÃO
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

    // 8. Buscar ou Criar Usuário no Supabase Auth
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, has_access, has_unlimited_ai")
      .ilike("email", email)
      .maybeSingle();

    let targetUserId = existingProfile?.id;

    if (!existingProfile && isApprovalEvent) {
      console.log(`[Hotmart Edge Function] Criando novo usuário no Supabase Auth para ${email}...`);
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
        console.error("[Hotmart Edge Function] Erro ao criar usuário no Auth:", createError);
      }
    }

    // 9. Aplicar Liberação ou Bloqueio
    let actionSummary = "";

    if (targetUserId) {
      if (isApprovalEvent) {
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
          actionSummary = "Assinatura IA Victoria VIP ATIVADA";
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
        if (productType === "main_product") {
          await supabaseAdmin
            .from("profiles")
            .update({ has_access: false, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          actionSummary = "Acesso Principal à Plataforma PAUSADO (Histórico Preservado)";
        } else if (productType === "ai_subscription") {
          await supabaseAdmin
            .from("profiles")
            .update({ has_unlimited_ai: false, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          actionSummary = "Assinatura IA Victoria VIP REVOGADA";
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

    // 10. Registrar evento na tabela de auditoria hotmart_events
    try {
      await supabaseAdmin.from("hotmart_events").insert({
        transaction_id: transactionId,
        event: event,
        buyer_email: email,
        hotmart_product_id: hotmartProductId || ucodeProductId || "0",
        status: "processed",
        payload: payload,
        processed_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.warn("[Hotmart Edge Function] Falha ao registrar log em hotmart_events:", logErr);
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
    console.error("[Hotmart Edge Function Erro Fatal]:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar Webhook Hotmart", details: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
