import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  console.log('[API DEBUG] users-list start');
  console.log('[API DEBUG] Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('[API DEBUG] Service Key:', supabaseServiceRoleKey ? 'Set' : 'Missing');
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error: Supabase URL or Service Role Key missing' });
  }

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const token = authHeader.split(' ')[1];
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Token inválido ou ausente' });
    }

    // Initialize Supabase with Service Role Key for admin actions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // Use anon client for verification - setting global header can be more reliable than getUser(token)
    const supabaseVerify = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // 1. Verify the user's token directly
    console.log('[API DEBUG] Verificando token via header global...');
    const { data: { user }, error: authError } = await supabaseVerify.auth.getUser();

    if (authError || !user) {
      console.error('[API DEBUG] Auth error in users-list API:', authError);
      
      // DIAGNOSTIC CORE: Decode JWT to see what's inside
      let tokenIssuer = 'unknown';
      let userId = 'unknown';
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        tokenIssuer = payload.iss;
        userId = payload.sub;
      } catch (e) {}

      return res.status(401).json({ 
        error: 'Token inválido ou expirado', 
        details: authError?.message || 'User not found in result',
        debug: {
            tokenIssuer,
            serverSupabaseUrl: supabaseUrl,
            userId,
            hasServiceKey: !!supabaseServiceRoleKey,
            errorName: (authError as any)?.name
        },
        hint: `O seu token vem de ${tokenIssuer}, mas o servidor espera ${supabaseUrl}. Verifique se VITE_SUPABASE_URL está configurada corretamente no painel de Configurações (Settings).`
      });
    }

    console.log('[API DEBUG] Usuário verificado:', user.email);
    
    // Fetch all users using admin API
    console.log('[API DEBUG] Fetching all users from auth admin...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('[API DEBUG] listUsers error:', listError);
      return res.status(500).json({ error: listError.message });
    }

    console.log(`[API DEBUG] Found ${users?.length || 0} users in auth`);

    // Also fetch profile data to merge (if needed)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profileError) {
      console.warn('[API DEBUG] profiles fetch warning:', profileError);
    }

    // Merge auth users with profiles
    const mergedUsers = users.map(u => {
      const profile = profiles?.find(p => p.id === u.id);
      return {
        ...u,
        ...profile,
        // Ensure ID and email from auth are prioritized or present
        id: u.id,
        email: u.email,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at
      };
    });

    return res.status(200).json(mergedUsers);
  } catch (error: any) {
    console.error('Users list error:', error);
    return res.status(500).json({ error: error.message });
  }
}
