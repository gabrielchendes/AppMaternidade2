import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Native Vercel Serverless Function - Standalone
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Fix CSP for redirect and assets - Use a more permissive one for the transition page
  res.setHeader('Content-Security-Policy', "default-src 'self' https:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  res.setHeader('X-Frame-Options', 'ALLOWALL');

  const token = (req.query.token as string) || (req.query.t as string);
  
  console.log(`[MAGIC-LOGIN] Processando request: token=${token ? 'PRESENTE' : 'AUSENTE'}, path=${req.url}`);

  if (!token) {
    return res.status(400).send('<h1>Acesso Negado</h1><p>Token de acesso não fornecido ou inválido.</p>');
  }

  try {
    // 1. Validar token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('magic_login_tokens')
      .select('user_id, active')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.warn('[MAGIC-LOGIN] Token não encontrado no banco:', tokenError);
      return res.status(404).send('<h1>Link Inválido</h1><p>Este link de acesso expirou ou não foi encontrado.</p>');
    }

    if (!tokenData.active) {
      console.warn('[MAGIC-LOGIN] Token inativo');
      return res.status(403).send('<h1>Link Desativado</h1><p>Este link foi revogado pelo administrador.</p>');
    }

    // 2. Buscar usuário para confirmar existência
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(tokenData.user_id);
    if (userError || !user) {
      console.error('[MAGIC-LOGIN] Usuário não encontrado no Auth:', userError);
      return res.status(404).send('<h1>Usuário não encontrado</h1>');
    }

    // 3. Registrar o último acesso (Background)
    supabaseAdmin
      .from('magic_login_tokens')
      .update({ last_access_at: new Date().toISOString() })
      .eq('token', token)
      .then();

    // 4. Determinar URL base dinâmica
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let baseUrl = process.env.VITE_APP_URL || process.env.APP_URL;

    if (!baseUrl && host) {
      baseUrl = `https://${host}`;
    }

    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = 'https://app-maternidade2.vercel.app';
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const redirectUrl = `${cleanBaseUrl}/dashboard`;

    console.log(`[MAGIC-LOGIN] Token OK para ${user.email}. Redirecionando via Supabase Auth para ${redirectUrl}`);

    // 5. Gerar Magic Link do Supabase (válido para login imediato)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
      options: { redirectTo: redirectUrl }
    });

    if (linkError) {
      console.error('[MAGIC-LOGIN] Erro ao gerar link do Supabase:', linkError);
      throw linkError;
    }

    const finalLink = linkData.properties?.action_link || (linkData as any).link;
    if (!finalLink) {
      console.error('[MAGIC-LOGIN] Falha: linkData sem action_link', linkData);
      throw new Error('Falha ao gerar link final de autenticação');
    }
    
    // Redirecionamento 302
    return res.redirect(finalLink);

  } catch (err: any) {
    console.error('[MAGIC-LOGIN] Erro Crítico:', err);
    return res.status(500).send('Erro interno ao processar login: ' + err.message);
  }
}
