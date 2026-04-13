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

    // 1. Find course by Hotmart Product ID
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('id')
      .eq('hotmart_product_id', hotmartProductId)
      .single()

    if (courseError || !course) {
      console.error(`Course not found for Hotmart ID: ${hotmartProductId}`)
      return new Response(JSON.stringify({ error: 'Course mapping not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // 3. Process Events
    const grantEvents = ['PURCHASE_APPROVED']
    const revokeEvents = [
      'PURCHASE_REFUNDED', 
      'PURCHASE_CHARGEBACK', 
      'SUBSCRIPTION_CANCELED', 
      'SUBSCRIPTION_EXPIRED'
    ]

    if (grantEvents.includes(event)) {
      // Grant access
      const { error: insertError } = await supabaseClient
        .from('purchases')
        .insert({ 
          user_id: user.id, 
          product_id: course.id 
        })
      
      // If already exists (code 23505), it's fine
      if (insertError && insertError.code !== '23505') {
        throw insertError
      }
      
      console.log(`Access GRANTED to ${email} for course ${course.id}`)
    } else if (revokeEvents.includes(event)) {
      // Revoke access
      const { error: deleteError } = await supabaseClient
        .from('purchases')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', course.id)
      
      if (deleteError) throw deleteError
      
      console.log(`Access REVOKED for ${email} from course ${course.id} due to ${event}`)
    }

    return new Response(JSON.stringify({ success: true, event }), {
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
