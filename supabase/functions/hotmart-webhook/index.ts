import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Webhooks should be POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    // Initialize Supabase Admin Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Parse Hotmart Webhook Data
    const body = await req.json()
    const { event, data, hottok } = body

    // Optional: Verify Hotmart Token for security
    const expectedToken = Deno.env.get('HOTMART_TOKEN')
    if (expectedToken && hottok !== expectedToken) {
      console.error('Invalid Hotmart Token received')
      return new Response(JSON.stringify({ error: 'Unauthorized token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const email = data?.buyer?.email
    const hotmartProductId = data?.product?.id?.toString()

    console.log(`Receiving event ${event} for ${email} and product ${hotmartProductId}`)

    if (!email || !hotmartProductId) {
      return new Response(JSON.stringify({ error: 'Missing data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Fetch the global settings to get the main_course_hotmart_id - Optimized to omit custom_texts for extreme speed, with graceful fallback
    let mainProductId = ''
    try {
      let { data: settings, error: selectError } = await supabaseClient
        .from('app_settings')
        .select('main_course_hotmart_id')
        .eq('id', 1)
        .maybeSingle()

      // Backup check if no row was returned with id=1
      if (!settings && !selectError) {
        const { data: fallbackList, error: listError } = await supabaseClient
          .from('app_settings')
          .select('main_course_hotmart_id')
          .limit(1)
        if (!listError && fallbackList && fallbackList.length > 0) {
          settings = fallbackList[0]
        }
      }

      if (!selectError && settings) {
        const mainRaw = settings.main_course_hotmart_id;
        mainProductId = (mainRaw !== null && mainRaw !== undefined) ? mainRaw.toString().trim() : '';
      } else if (selectError) {
        console.log(`Warning fetching main_course_hotmart_id: ${selectError.message}. Performing fallback to custom_texts...`)
      }
    } catch (err) {
      console.error(`Error with direct select:`, err)
    }

    // Fallback if column does not exist or value is empty
    if (mainProductId === '') {
      try {
        let { data: fallbackSettings } = await supabaseClient
          .from('app_settings')
          .select('custom_texts')
          .eq('id', 1)
          .maybeSingle()
        
        // Backup fallback if ID=1 doesn't exist
        if (!fallbackSettings) {
          const { data: fallbackList } = await supabaseClient
            .from('app_settings')
            .select('custom_texts')
            .limit(1)
          if (fallbackList && fallbackList.length > 0) {
            fallbackSettings = fallbackList[0]
          }
        }
        
        const customTexts = fallbackSettings?.custom_texts || {}
        mainProductId = (customTexts['main_product_id'] || '').trim()
        console.log(`Fallback retrieved from custom_texts: ${mainProductId}`)
      } catch (fbErr) {
        console.error('Error on custom_texts fallback:', fbErr)
      }
    }

    let targetIds: string[] = []
    let isMainCourse = false
    const hotmartProductName = (data?.product?.name || '').trim()

    // Se bater com o Produto Principal configurado globalmente OR se for o ID '0' de sandbox/teste da Hotmart e a tabela app_settings não puder ser lida ou for zero
    let isMainProductMatch = (mainProductId !== '' && hotmartProductId === mainProductId) || 
                             (hotmartProductId === '0' && (mainProductId === '' || mainProductId === '0'));

    // Se for teste com ID '0' mas possuímos nome do produto, tentamos encontrar um curso ou pacote correspondente antes de assumir o produto principal!
    let resolvedByTestName = false
    if (hotmartProductId === '0' && hotmartProductName !== '') {
      try {
        // 1. Busca se há pacote com este nome
        const { data: pkg } = await supabaseClient
          .from('course_packages')
          .select('id, package_courses(course_id)')
          .ilike('title', hotmartProductName)
          .maybeSingle()

        if (pkg) {
          targetIds = [pkg.id, ...(pkg.package_courses?.map((pc: any) => pc.course_id) || [])]
          resolvedByTestName = true
          isMainProductMatch = false
          console.log(`[TESTE ID 0] Produto mapeado por NOME como pacote: ${pkg.id}`)
        }

        // 2. Se não achou pacote, busca se há curso com este nome
        if (!resolvedByTestName) {
          const { data: course } = await supabaseClient
            .from('courses')
            .select('id')
            .ilike('title', hotmartProductName)
            .maybeSingle()

          if (course) {
            targetIds = [course.id]
            resolvedByTestName = true
            isMainProductMatch = false
            console.log(`[TESTE ID 0] Produto mapeado por NOME como curso: ${course.id}`)
          }
        }
      } catch (err) {
        console.error('Erro ao mapear produto de teste por nome na edge function:', err)
      }
    }

    if (isMainProductMatch) {
      isMainCourse = true
      
      // Fetch the UUID of the main course in Supabase (is_free = true, is_bonus = false)
      const { data: mainCourse } = await supabaseClient
        .from('courses')
        .select('id')
        .eq('is_free', true)
        .eq('is_bonus', false)
        .maybeSingle()

      if (mainCourse && mainCourse.id) {
        targetIds = [mainCourse.id]
        console.log(`Produto principal identificado (ID: ${hotmartProductId}). Mapeado para o UUID do curso principal correspondente no Supabase: ${mainCourse.id}`)
      } else {
        // Fallback resiliente: se não achar o curso principal exato com is_free=true & is_bonus=false, busca qualquer curso disponível
        const { data: fallbackList } = await supabaseClient
          .from('courses')
          .select('id')
          .limit(1)
        if (fallbackList && fallbackList.length > 0) {
          targetIds = [fallbackList[0].id]
          console.log(`Aviso: Curso principal (is_free=true, is_bonus=false) não encontrado no Supabase. Utilizando primeiro curso disponível como fallback: ${fallbackList[0].id}`)
        } else {
          targetIds = [hotmartProductId]
          console.log(`Incoming purchase is for Product ID: ${hotmartProductId} (no corresponding course was found)`)
        }
      }
    } else {
      // Check if it's a package directly
      const { data: pkg } = await supabaseClient
        .from('course_packages')
        .select('id, package_courses(course_id)')
        .eq('hotmart_product_id', hotmartProductId)
        .maybeSingle()

      if (pkg) {
        targetIds = [pkg.id, ...(pkg.package_courses?.map((pc: any) => pc.course_id) || [])]
        console.log(`Found package ${pkg.id} for Hotmart ID ${hotmartProductId}, expanded to ${targetIds.length} items`)
      } else {
        // Check if it's a course
        const { data: course } = await supabaseClient
          .from('courses')
          .select('id')
          .eq('hotmart_product_id', hotmartProductId)
          .maybeSingle()

        if (course) {
          targetIds = [course.id]
          console.log(`Course identified directly (ID: ${hotmartProductId}). Mapeado para o UUID do curso correspondente no Supabase: ${course.id}`)
        }
      }
    }

    if (targetIds.length === 0) {
      console.error(`Product not found for Hotmart ID: ${hotmartProductId}`)
      return new Response(JSON.stringify({ 
        error: `Produto Hotmart ID ${hotmartProductId} não mapeado no painel administrativo.`,
        debug: {
          resolvedProductId: hotmartProductId,
          mainProductId: mainProductId,
          mainProductIdType: typeof mainProductId,
          hasMainProductMatch: (mainProductId !== '' && hotmartProductId === mainProductId),
          isMainProductIdEmpty: (mainProductId === ''),
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: 404,
      })
    }

    // 2. Find or Create user by email
    const { data: { users }, error: userError } = await supabaseClient.auth.admin.listUsers()
    if (userError) throw userError

    let user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      console.log(`User not found, creating new user for: ${email}`)
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { 
          full_name: data?.buyer?.name || '',
          is_auto_created: true
        }
      })
      
      if (createError) throw createError
      user = newUser.user
    }

    if (!user) {
      throw new Error('Could not find or create user')
    }

    // Ensure profile row exists in public.profiles to avoid foreign key violations on transactions insertion
    try {
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: user.id,
          email: email.trim().toLowerCase(),
          full_name: data?.buyer?.name || 'Aluna Premium',
          has_access: true
        }, { onConflict: 'id' });
      if (profileError) {
        console.warn('Aviso ao sincronizar perfil na tabela public.profiles:', profileError.message);
      }
    } catch (err: any) {
      console.warn('Erro ao sincronizar perfil na tabela public.profiles:', err.message);
    }

    // 3. Process Events
    const grantEvents = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']
    const revokeEvents = [
      'PURCHASE_REFUNDED', 
      'PURCHASE_CHARGEBACK', 
      'SUBSCRIPTION_CANCELED', 
      'SUBSCRIPTION_EXPIRED'
    ]

    if (grantEvents.includes(event)) {
      // Grant access to all resolved IDs
      for (const tid of targetIds) {
        const { error: insertError } = await supabaseClient
          .from('purchases')
          .insert({ 
            user_id: user.id, 
            product_id: tid,
            transaction_id: data?.purchase?.transaction || `hotmart_${Date.now()}`
          })
        
        if (insertError && insertError.code !== '23505') {
          console.error(`Error granting ${tid} to ${email}:`, insertError)
        }
      }
      
      console.log(`Access GRANTED to ${email} for ${targetIds.length} items`)
    } else if (revokeEvents.includes(event)) {
      if (isMainCourse) {
        // Delete user completely from Supabase auth
        const { error: deleteUserError } = await supabaseClient.auth.admin.deleteUser(user.id);
        if (deleteUserError) throw deleteUserError;
        console.log(`User ${email} deleted completely because the main course was canceled`);
      } else {
        // Revoke access only for the target course/package IDs
        const { error: deleteError } = await supabaseClient
          .from('purchases')
          .delete()
          .eq('user_id', user.id)
          .in('product_id', targetIds)
        
        if (deleteError) throw deleteError
        
        console.log(`Access REVOKED for ${email} from ${targetIds.length} items due to ${event}`)
      }
    }

    return new Response(JSON.stringify({ success: true, event, items_processed: targetIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
