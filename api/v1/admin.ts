import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { initNodeWarningHandler } from '../../src/serverUtils/nodeWarningHandler';

initNodeWarningHandler();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://fhnmpltilhongdofnzbj.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey || 'anon-key-placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const queryAction = req.query?.action as string;
  const pathParts = url.split('?')[0].split('/');
  const urlAction = pathParts[pathParts.length - 1];
  let action = queryAction || urlAction;
  
  // Handle user-delete/[id] pattern or ?action=user-delete&id=...
  let id = (req.query?.id as string) || null;
  if (url.includes('/user-delete/')) {
    id = url.split('/user-delete/')[1].split('?')[0];
    action = 'user-delete';
  }

  try {
    // Auth Check for Admin APIs
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: No token provided' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized: Invalid token format' });

    let user: any = null;
    try {
      const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !data?.user) {
        console.warn('[Admin API] auth.getUser warning:', authError?.message);
        return res.status(401).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
      }
      user = data.user;
    } catch (authErr: any) {
      console.error('[Admin API] auth error:', authErr);
      return res.status(401).json({ error: 'Erro de validação de autenticação: ' + (authErr.message || '') });
    }

    // Admin Verification (Double Check)
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, is_admin').eq('id', user.id).maybeSingle();
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email, app_url').eq('id', 1).maybeSingle();
    
    const isHardcodedAdmin = user.email?.toLowerCase() === 'gabrielchendes@gmail.com';
    const isSuperAdmin = (settings?.admin_email && user.email?.toLowerCase() === settings.admin_email.toLowerCase()) || isHardcodedAdmin;
    
    const isUserAdmin = profile?.is_admin || isSuperAdmin;
    const publicActions = ['comment-like'];

    if (!isUserAdmin && !publicActions.includes(action)) {
      return res.status(403).json({ error: 'Acesso negado: Apenas administradores' });
    }

    switch (action) {
      case 'users-list':
        return await handleUsersList(req, res);
      case 'user-create':
        return await handleUserCreate(req, res);
      case 'user-delete':
        return await handleUserDelete(req, res, id || req.query.id as string);
      case 'user-access-toggle':
        return await handleAccessToggle(req, res);
      case 'user-password-change':
        return await handleUserPasswordChange(req, res);
      case 'grant-access':
        return await handleGrantAccess(req, res);
      case 'purchases-list':
        return await handlePurchases(req, res);
      case 'update-settings':
        return await handleUpdateSettings(req, res);
      case 'comment-like':
        return await handleCommentLike(req, res);
      case 'post-likes-update':
        return await handlePostLikesUpdate(req, res);
      case 'products-list':
        return await handleProductsList(req, res);
      case 'product-save':
        return await handleProductSave(req, res);
      case 'product-delete':
        return await handleProductDelete(req, res);
      case 'product-sync-migration':
        return await handleProductSyncMigration(req, res);
      case 'webhook-events-list':
        return await handleWebhookEventsList(req, res);
      case 'webhook-simulate':
        return await handleWebhookSimulate(req, res);
      case 'sales-list':
        return await handleSalesList(req, res);
      case 'info':
        return res.status(200).json({ status: 'online', version: '2.5.0' });
      default:
        return res.status(404).json({ error: 'Action not found: ' + action });
    }
  } catch (error: any) {
    console.error(`[Admin API] Error details:`, {
      message: (error as any).message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
      stack: (error as any).stack
    });
    return res.status(500).json({ 
      error: (error as any).message || 'Internal Server Error',
      details: (error as any).details || null
    });
  }
}

async function handleUsersList(req: VercelRequest, res: VercelResponse) {
  try {
    let authUsers: any[] = [];
    try {
      const listDataRes = await supabaseAdmin.auth.admin.listUsers();
      if (listDataRes?.data?.users) {
        authUsers = listDataRes.data.users;
      }
    } catch (e: any) {
      console.warn('[Admin API] listUsers fallback due to:', e.message);
    }

    const [profilesRes, purchasesRes, pushTokensRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('purchases').select('user_id, product_id'),
      supabaseAdmin.from('push_tokens').select('user_id')
    ]);
    
    const profiles = profilesRes.data || [];
    const purchases = purchasesRes.data || [];
    const pushTokens = pushTokensRes.data || [];
    
    // If authUsers is available from service role, merge them. Otherwise, synthesize from profiles.
    let baseList = authUsers;
    if (baseList.length === 0 && profiles.length > 0) {
      baseList = profiles.map(p => ({
        id: p.id,
        email: p.email,
        created_at: p.created_at || new Date().toISOString(),
        user_metadata: { full_name: p.full_name }
      }));
    }

    const merged = baseList.map((u: any) => {
      const profile = profiles.find((p: any) => p.id === u.id || (p.email && u.email && p.email.toLowerCase() === u.email.toLowerCase()));
      const hasPush = Array.isArray(pushTokens) && pushTokens.some((t: any) => t.user_id === u.id);
      
      const hasAiPurchase = purchases.some((pur: any) => {
        const pUser = String(pur.user_id || '').toLowerCase();
        const uId = String(u.id || '').toLowerCase();
        const uEmail = String(u.email || '').toLowerCase();
        const isUserMatch = pUser === uId || (uEmail && pUser === uEmail);
        const pId = String(pur.product_id || '').toLowerCase();
        const isAiProd = ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(pId);
        return isUserMatch && isAiProd;
      });

      let hasUnlimitedAi = false;
      if (profile?.has_unlimited_ai === false || u.user_metadata?.has_unlimited_ai === false) {
        hasUnlimitedAi = false;
      } else if (
        profile?.has_unlimited_ai === true || 
        u.user_metadata?.has_unlimited_ai === true || 
        hasAiPurchase === true
      ) {
        hasUnlimitedAi = true;
      }

      return { 
        ...u, 
        ...profile, 
        id: u.id, 
        email: u.email,
        has_unlimited_ai: hasUnlimitedAi,
        push_enabled: !!hasPush 
      };
    });
    return res.status(200).json(merged);
  } catch (err: any) {
    console.error('[Admin API] Error in handleUsersList:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleUserCreate(req: VercelRequest, res: VercelResponse) {
  const { email, password, fullName, phone } = req.body;
  
  if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });
  
  const emailLower = email.toLowerCase().trim();
  const defaultPassword = password || '123456';

  try {
    // 1. Check if user already exists in Auth
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const existingUser = (usersData?.users as any[])?.find((u: any) => u.email?.toLowerCase() === emailLower);
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Este e-mail já está cadastrado no sistema.',
        details: 'user_exists'
      });
    }

    // 2. Aggressive cleanup of any orphaned data that could cause trigger failure
    // Delete by email and also check if there's any user with that email in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existingProfile) {
      console.log(`[Admin API] Deleting existing profile for ${emailLower} before creation`);
      await supabaseAdmin.from('profiles').delete().eq('id', existingProfile.id);
    }

    // 3. Create Auth User
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower, 
      password: defaultPassword, 
      email_confirm: true, 
      user_metadata: { 
        full_name: fullName, 
        phone, 
        temp_password: defaultPassword 
      }
    });

    if (error) {
      console.error('[Admin API] Create user error:', error);
      // Give more specific feedback for database errors
      if (error.message.includes('Database error')) {
        return res.status(400).json({ 
          error: 'Erro no Banco de Dados: O e-mail pode estar vinculado a um registro excluído recentemente. Tente novamente em alguns segundos.',
          details: error.message
        });
      }
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      // 4. Force Profile (Wait a bit for trigger then upsert to be safe)
      // Small delay helps the trigger complete its work
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await supabaseAdmin.from('profiles').upsert({ 
        id: data.user.id, 
        email: emailLower, 
        full_name: fullName, 
        phone 
      }, { onConflict: 'email' });
    }

    return res.status(200).json({ success: true, user: data.user });
  } catch (err: any) {
    console.error('[Admin API] Unexpected error in user creation:', err);
    return res.status(500).json({ error: 'Erro interno ao criar usuário: ' + (err.message || 'Erro desconhecido') });
  }
}

async function handleUserDelete(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id) return res.status(400).json({ error: 'ID required' });
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) throw error;
  await supabaseAdmin.from('profiles').delete().eq('id', id);
  return res.status(200).json({ success: true });
}

async function handleUserPasswordChange(req: VercelRequest, res: VercelResponse) {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: 'ID do usuário e nova senha são obrigatórios' });
  
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { 
    password: newPassword,
    user_metadata: { temp_password: newPassword }
  });
  
  if (error) throw error;
  return res.status(200).json({ success: true });
}

async function handleAccessToggle(req: VercelRequest, res: VercelResponse) {
  const { userId, userEmail, hasAccess, courseId, action } = req.body;
  
  try {
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // If courseId and action are present, check if it's AI Subscription, Main Product or Course/Package
    if (courseId && action) {
      const cleanCourseId = String(courseId).trim();

      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('custom_texts')
        .eq('id', 1)
        .maybeSingle();

      const catalog = await getFallbackCatalog(settings);

      let isAiSub = cleanCourseId === 'ai_subscription';
      let isMainProd = cleanCourseId === 'main_product';

      if (!isAiSub && !isMainProd) {
        // Check DB hotmart_products
        const { data: dbProd } = await supabaseAdmin
          .from('hotmart_products')
          .select('product_type')
          .or(`hotmart_product_id.eq.${cleanCourseId},id.eq.${cleanCourseId}`)
          .maybeSingle();

        if (dbProd) {
          if (dbProd.product_type === 'ai_subscription') isAiSub = true;
          if (dbProd.product_type === 'main_product') isMainProd = true;
        } else {
          const catMatch = catalog.find(p => p.id === cleanCourseId || String(p.hotmart_product_id).trim() === cleanCourseId);
          if (catMatch) {
            if (catMatch.product_type === 'ai_subscription') isAiSub = true;
            if (catMatch.product_type === 'main_product') isMainProd = true;
          } else {
            const configuredMainId = settings?.custom_texts?.['hotmart.main_product_id'] || settings?.custom_texts?.['main_course_hotmart_id'];
            const configuredAiId = settings?.custom_texts?.['hotmart.unlimited_ai_product_id'] || settings?.custom_texts?.['hotmart.ai_product_id'];

            if (configuredAiId && String(configuredAiId).trim() === cleanCourseId) isAiSub = true;
            if (configuredMainId && String(configuredMainId).trim() === cleanCourseId) isMainProd = true;
          }
        }
      }

      if (isAiSub) {
        const shouldGrant = action === 'grant';
        const cleanUserId = String(userId).trim();
        const cleanUserEmail = userEmail ? String(userEmail).trim() : '';

        const isUUID = (str: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        let targetProfile: { id: string; email?: string } | null = null;

        // 1. Safe profile lookup
        if (isUUID(cleanUserId)) {
          const { data } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('id', cleanUserId)
            .maybeSingle();
          if (data) targetProfile = data;
        }

        if (!targetProfile && (cleanUserEmail || cleanUserId.includes('@'))) {
          const emailToFind = (cleanUserEmail || cleanUserId).toLowerCase();
          const { data } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('email', emailToFind)
            .maybeSingle();
          if (data) targetProfile = data;
        }

        // 2. Auth.users fallback lookup
        if (!targetProfile) {
          try {
            const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
            const foundUser = authData?.users?.find((u: any) =>
              (isUUID(cleanUserId) && u.id === cleanUserId) ||
              (u.email && cleanUserEmail && u.email.toLowerCase() === cleanUserEmail.toLowerCase()) ||
              (u.email && cleanUserId.includes('@') && u.email.toLowerCase() === cleanUserId.toLowerCase())
            );

            if (foundUser) {
              targetProfile = { id: foundUser.id, email: foundUser.email };
            }
          } catch (aErr) {
            console.warn('[user-access-toggle] auth.listUsers note:', aErr);
          }
        }

        const effectiveId = targetProfile?.id || (isUUID(cleanUserId) ? cleanUserId : null);
        const effectiveEmail = targetProfile?.email || cleanUserEmail || (cleanUserId.includes('@') ? cleanUserId : null);

        // 3. Update Profiles Table
        if (effectiveId) {
          const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({
              has_unlimited_ai: shouldGrant,
              updated_at: new Date().toISOString()
            })
            .eq('id', effectiveId);

          if (updateErr) {
            await supabaseAdmin.from('profiles').upsert({
              id: effectiveId,
              email: effectiveEmail || undefined,
              has_unlimited_ai: shouldGrant,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          }
        }

        if (effectiveEmail) {
          await supabaseAdmin
            .from('profiles')
            .update({
              has_unlimited_ai: shouldGrant,
              updated_at: new Date().toISOString()
            })
            .ilike('email', effectiveEmail.toLowerCase());
        }

        // 3.5 Update Auth User Metadata
        const authUserId = (effectiveId && isUUID(effectiveId)) ? effectiveId : (cleanUserId && isUUID(cleanUserId) ? cleanUserId : null);
        if (authUserId) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(authUserId, {
              user_metadata: {
                has_unlimited_ai: shouldGrant
              }
            });
          } catch (uErr) {
            console.warn('[user-access-toggle] auth.updateUserById note:', uErr);
          }
        }

        // 4. Synchronize Purchases Table
        try {
          const configuredAiId = settings?.custom_texts?.['hotmart.unlimited_ai_product_id'] || settings?.custom_texts?.['hotmart.ai_product_id'];
          const aiProductIdsToDelete = Array.from(new Set([
            'ai_subscription',
            'prod_ai_default',
            'HOTMART_IA_VICTORIA',
            'hotmart_ia_victoria',
            'ia_vip',
            'IA_VIP',
            'unlimited_ai',
            'ai_unlimited',
            ...(configuredAiId ? [String(configuredAiId).trim()] : [])
          ].filter(Boolean)));

          const userIdentifiers = Array.from(new Set([
            effectiveId,
            effectiveEmail,
            cleanUserId,
            cleanUserEmail
          ].filter(Boolean)));

          if (shouldGrant) {
            for (const uid of userIdentifiers) {
              const { data: existingP } = await supabaseAdmin
                .from('purchases')
                .select('id')
                .eq('user_id', uid)
                .in('product_id', aiProductIdsToDelete)
                .maybeSingle();

              if (!existingP) {
                await supabaseAdmin
                  .from('purchases')
                  .insert({
                    user_id: uid,
                    product_id: 'ai_subscription',
                    is_manual: true,
                    created_at: new Date().toISOString()
                  });
              }
            }
          } else {
            // Revoke
            for (const uid of userIdentifiers) {
              if (isUUID(uid)) {
                await supabaseAdmin
                  .from('purchases')
                  .delete()
                  .eq('user_id', uid)
                  .in('product_id', aiProductIdsToDelete);
              }
              if (uid.includes('@')) {
                await supabaseAdmin
                  .from('purchases')
                  .delete()
                  .ilike('user_id', uid)
                  .in('product_id', aiProductIdsToDelete);
              }
            }
          }
        } catch (syncErr) {
          console.warn('[user-access-toggle] Purchases sync note:', syncErr);
        }

        return res.status(200).json({ 
          success: true, 
          message: shouldGrant ? 'Assinatura IA Expert VIP (Ilimitada) liberada!' : 'Assinatura IA Expert VIP revogada.' 
        });
      }

      if (isMainProd) {
        const shouldGrant = action === 'grant';
        const { error: pErr } = await supabaseAdmin
          .from('profiles')
          .update({ 
            has_access: shouldGrant, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', userId);

        if (pErr) throw pErr;

        return res.status(200).json({ 
          success: true, 
          message: shouldGrant ? 'Acesso Principal à Plataforma liberado!' : 'Acesso Principal revogado.' 
        });
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);
      
      let targetCourseIds: string[] = [];
      
      if (isUUID) {
        // If it's a UUID, it could be a course OR a package
        targetCourseIds.push(courseId);
        
        const { data: pkgData } = await supabaseAdmin
          .from('course_packages')
          .select('id, package_courses(course_id)')
          .eq('id', courseId)
          .maybeSingle();

        if (pkgData) {
          const expandedIds = pkgData.package_courses?.map((pc: any) => pc.course_id) || [];
          if (expandedIds.length > 0) {
            targetCourseIds = [...new Set([courseId, ...expandedIds])];
            console.log(`[Admin API] Expanding package ${courseId} to ${targetCourseIds.length} items`);
          }
        } else {
          // Check if it's a course with a linked package
          const { data: courseData } = await supabaseAdmin
            .from('courses')
            .select('linked_package_id')
            .eq('id', courseId)
            .maybeSingle();
            
          if (courseData?.linked_package_id) {
            const { data: pData } = await supabaseAdmin.from('course_packages').select('id, package_courses(course_id)').eq('id', courseData.linked_package_id).maybeSingle();
            if (pData) {
               const pkgIds = pData.package_courses?.map((pc: any) => pc.course_id) || [];
               targetCourseIds = [...new Set([pData.id, ...pkgIds])];
               console.log(`[Admin API] UUID matches course with linked package ${pData.id}, expanding to ${targetCourseIds.length} items`);
            }
          }
        }
      } else {
        // If not a UUID, it's definitely a Hotmart ID or invalid
        const { data: pkgData } = await supabaseAdmin
          .from('course_packages')
          .select('id, package_courses(course_id)')
          .eq('hotmart_product_id', courseId)
          .maybeSingle();
          
        if (pkgData) {
          const expandedIds = pkgData.package_courses?.map((pc: any) => pc.course_id) || [];
          targetCourseIds = [...new Set([pkgData.id, ...expandedIds])];
          console.log(`[Admin API] Found package by hotmart ID ${courseId}, expanded to ${targetCourseIds.length} items (excluding non-UUID)`);
        } else {
          const { data: courseData } = await supabaseAdmin
            .from('courses')
            .select('id, linked_package_id')
            .eq('hotmart_product_id', courseId)
            .maybeSingle();
            
          if (courseData) {
            targetCourseIds = [courseData.id];
            console.log(`[Admin API] Found course by hotmart ID ${courseId}: ${courseData.id}`);
            
            // Check for linked package
            if (courseData.linked_package_id) {
              const { data: pData } = await supabaseAdmin.from('course_packages').select('id, package_courses(course_id)').eq('id', courseData.linked_package_id).maybeSingle();
              if (pData) {
                 const pkgIds = pData.package_courses?.map((pc: any) => pc.course_id) || [];
                 targetCourseIds = [...new Set([pData.id, ...pkgIds])];
                 console.log(`[Admin API] Course has linked package ${pData.id}, expanding to ${targetCourseIds.length} items`);
              }
            }
          }
        }
      }

      if (targetCourseIds.length === 0 && !isUUID) {
        return res.status(400).json({ error: 'Produto não encontrado ou ID inválido' });
      } else if (targetCourseIds.length === 0 && isUUID) {
        targetCourseIds = [courseId];
      }

      const results = [];
      console.log(`[Admin API] Starting toggle for userId: ${userId}, targetCourseIds: ${JSON.stringify(targetCourseIds)}`);

      for (const cid of targetCourseIds) {
        // Skip if not a UUID at this point (prevents DB errors)
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
          console.warn(`[Admin API] Skipping CID ${cid} because it is not a valid UUID`);
          results.push({ id: cid, status: 'error', error: 'Internal Error: Resolved ID is not a UUID' });
          continue;
        }

        if (action === 'grant') {
          const transactionId = `manual_${Date.now()}_${cid.substring(0, 8)}`;
          
          const { data: existing, error: checkError } = await supabaseAdmin
            .from('purchases')
            .select('product_id')
            .match({ user_id: userId, product_id: cid })
            .maybeSingle();

          if (checkError) {
            console.error(`[Admin API] CheckError for user ${userId}, product ${cid}:`, checkError);
            results.push({ id: cid, status: 'error', error: checkError.message, code: checkError.code });
            continue;
          }

          if (existing) {
            results.push({ id: cid, status: 'already_exists' });
            continue;
          }

          console.log(`[Admin API] Inserting purchase for user ${userId}, product ${cid}`);
          
          // Reusable Grant Function with nested fallbacks
          const grantWithFallbacks = async (idToGrant: string) => {
            // Attempt 1: Full insert
            const { error: e1 } = await supabaseAdmin.from('purchases').insert({
              user_id: userId,
              product_id: idToGrant,
              transaction_id: transactionId,
              is_manual: true
            });

            if (!e1) return { status: 'granted' };
            
            // If Code 23503: FK Constraint. Check if it's a known package
            if (e1.code === '23503') {
              const { data: pkgById } = await supabaseAdmin.from('course_packages').select('id').eq('id', idToGrant).maybeSingle();
              const { data: pkgByHotmart } = pkgById ? {data: null} : await supabaseAdmin.from('course_packages').select('id').eq('hotmart_product_id', idToGrant).maybeSingle();
              if (pkgById || pkgByHotmart) {
                // If it's a package, expansion happened earlier, so it's "fine" that the package record itself fails if FK is strict
                return { status: 'skipped_package_fk', info: 'Package record not saved due to database restriction (FK), but its courses were processed.' };
              }
              console.warn(`[Admin API] FK Error for ${idToGrant}: ${e1.message}`);
              return { status: 'error', error: `Produto ${idToGrant} não encontrado no banco de dados.`, code: e1.code };
            }

            // If Column missing errors (42703 or PGRST204) - Silence these as they are handled by fallbacks
            if (e1.code === '42703' || e1.code === 'PGRST204') {
              // Attempt 2: Remove transaction_id
              const { error: e2 } = await supabaseAdmin.from('purchases').insert({
                user_id: userId,
                product_id: idToGrant,
                is_manual: true
              });
              if (!e2) return { status: 'granted_minimal' };

              // Attempt 3: Remove is_manual
              const { error: e3 } = await supabaseAdmin.from('purchases').insert({
                user_id: userId,
                product_id: idToGrant
              });
              if (!e3) return { status: 'granted_minimal' };
              
              return { status: 'error', error: e3.message, code: e3.code };
            }

            console.error(`[Admin API] Grant failed for ${idToGrant}:`, e1);
            return { status: 'error', error: e1.message, code: e1.code };
          };

          const grantResult = await grantWithFallbacks(cid);
          results.push({ id: cid, ...grantResult });

        } else if (action === 'revoke') {
          console.log(`[Admin API] Revoking purchase for user ${userId}, product ${cid}`);
          const { error: deleteError } = await supabaseAdmin
            .from('purchases')
            .delete()
            .match({ user_id: userId, product_id: cid });
          
          if (deleteError) {
            console.error(`[Admin API] DeleteError for user ${userId}, product ${cid}:`, deleteError);
            results.push({ id: cid, status: 'error', error: deleteError.message });
          } else {
            results.push({ id: cid, status: 'revoked' });
          }
        }
      }
      
      const hasAnySuccess = results.some(r => {
        const s = r.status;
        return (typeof s === 'string' && s.includes('granted')) || 
               s === 'revoked' || 
               s === 'already_exists' ||
               s === 'skipped_package_fk' ||
               s === 'granted_minimal';
      });
      console.log(`[Admin API] Toggle results: ${JSON.stringify(results)}, hasAnySuccess: ${hasAnySuccess}`);
      
      if (!hasAnySuccess && targetCourseIds.length > 0) {
        // Find the first real error to report
        const firstError = results.find(r => r.status === 'error');
        const errorMsg = firstError ? firstError.error : 'Não foi possível alterar o acesso para nenhum dos itens.';
        
        return res.status(400).json({ 
          error: errorMsg,
          details: results
        });
      }
      
      return res.status(200).json({ success: true, results });
    }

    // Default to profile global access toggle if course params are missing
    const { error: updateError } = await supabaseAdmin.from('profiles').update({ has_access: hasAccess }).eq('id', userId);
    if (updateError) {
      // If column doesn't exist, we don't want to crash the whole admin panel
      if (updateError.code === '42703') {
        return res.status(200).json({ success: true, warning: 'Coluna has_access não existe no banco de dados.' });
      }
      throw updateError;
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[Admin API] Toggle access unexpected error:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      context: { userId, courseId, action }
    });
    return res.status(500).json({ 
      error: err.message || 'Erro interno ao alterar acesso',
      details: err.details || null
    });
  }
}

async function handleGrantAccess(req: VercelRequest, res: VercelResponse) {
  const { email, courses } = req.body;
  // Simplified logic, usually involves inserting into a many-to-many table
  return res.status(200).json({ success: true });
}

async function handlePurchases(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.userId as string;
  
  try {
    let purchases: any[] = [];
    let targetProfile: any = null;

    if (userId) {
      // Lookup profile to check email and VIP status
      const { data: pProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, has_unlimited_ai')
        .eq('id', userId)
        .maybeSingle();
      targetProfile = pProfile;

      const userEmail = targetProfile?.email;
      let qBase = supabaseAdmin.from('purchases').select('*');
      if (userEmail) {
        qBase = qBase.or(`user_id.eq.${userId},user_id.ilike.${userEmail}`);
      } else {
        qBase = qBase.eq('user_id', userId);
      }

      const { data: pData, error: pError } = await qBase.order('created_at', { ascending: false });
      if (pError) throw pError;
      purchases = pData || [];

      // Check if VIP AI is active for this user
      const hasAiInPurchases = purchases.some(p => 
        ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(String(p.product_id).toLowerCase())
      );

      if (targetProfile?.has_unlimited_ai === true && !hasAiInPurchases) {
        purchases.unshift({
          id: 'manual_ai_' + userId,
          user_id: userId,
          product_id: 'ai_subscription',
          is_manual: true,
          created_at: new Date().toISOString()
        });
      } else if (targetProfile?.has_unlimited_ai === false) {
        purchases = purchases.filter(p => 
          !['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(String(p.product_id).toLowerCase())
        );
      }
    } else {
      const { data: pData, error: pError } = await supabaseAdmin.from('purchases').select('*').order('created_at', { ascending: false });
      if (pError) throw pError;
      purchases = pData || [];
    }

    if (!purchases || purchases.length === 0) {
      return res.status(200).json([]);
    }

    // Extract unique user/product IDs for targeted sub-queries
    const userIds = Array.from(new Set(purchases.map(p => p.user_id).filter(Boolean)));
    const productIds = Array.from(new Set(purchases.map(p => p.product_id).filter(Boolean)));

    // Fetch matching profiles, courses, and packages in parallel
    const [profilesRes, coursesRes, packagesRes] = await Promise.all([
      userIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, email, full_name').in('id', userIds)
        : Promise.resolve({ data: [] }),
      productIds.length > 0
        ? supabaseAdmin.from('courses').select('id, title, price').in('id', productIds)
        : Promise.resolve({ data: [] }),
      productIds.length > 0
        ? supabaseAdmin.from('course_packages').select('id, title, price').in('id', productIds)
        : Promise.resolve({ data: [] })
    ]);

    // Enrich purchases with fetched data
    const enriched = purchases.map(p => ({
      ...p,
      profiles: profilesRes.data?.find(prof => prof.id === p.user_id) || null,
      courses: coursesRes.data?.find(c => c.id === p.product_id) || null,
      course_packages: packagesRes.data?.find(pkg => pkg.id === p.product_id) || null
    }));

    return res.status(200).json(enriched);
  } catch (err: any) {
    console.error('[Admin API] All purchase list retrieval routines failed:', err);
    return res.status(500).json({ error: err.message || 'Erro ao carregar lista de vendas' });
  }
}

async function handleCommentLike(req: VercelRequest, res: VercelResponse) {
  const { commentId, likesCount } = req.body;
  if (!commentId || typeof likesCount !== 'number') {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    // 1. Fetch the comment
    const { data: comment, error: fetchError } = await supabaseAdmin
      .from('post_comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    // 2. Parse existing content and clean text, and format with the new likesCount
    const originalContent = comment.content || '';
    // Extract text by removing any trailing [likes:X]
    const cleanText = originalContent.replace(/\s+\[likes:\d+\]$/s, '');
    const updatedContent = likesCount > 0 ? `${cleanText} [likes:${likesCount}]` : cleanText;

    // 3. Update the comment content on Supabase (using service role key, bypassing RLS!)
    const { data: updatedComment, error: updateError } = await supabaseAdmin
      .from('post_comments')
      .update({ content: updatedContent })
      .eq('id', commentId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[Admin API] Error updating comment content:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar comentário' });
    }

    return res.status(200).json(updatedComment);
  } catch (err: any) {
    console.error('[Admin API] handleCommentLike failed:', err);
    return res.status(500).json({ error: err.message || 'Erro ao curtir comentário' });
  }
}

async function handlePostLikesUpdate(req: VercelRequest, res: VercelResponse) {
  const { postId, likesCount } = req.body;
  if (!postId || typeof likesCount !== 'number') {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('community_posts')
      .update({ likes_count: Math.max(0, likesCount) })
      .eq('id', postId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[Admin API] Error updating post likes:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar curtidas do post' });
    }

    return res.status(200).json(updatedPost);
  } catch (err: any) {
    console.error('[Admin API] handlePostLikesUpdate failed:', err);
    return res.status(500).json({ error: err.message || 'Erro ao curtir post' });
  }
}

async function handleUpdateSettings(req: VercelRequest, res: VercelResponse) {
  const { settings: newSettings, adminPassword } = req.body;
  if (!newSettings) return res.status(400).json({ error: 'Configurações não fornecidas' });

  const payload = { ...newSettings };
  if ('support_type' in payload) {
    if (!payload.custom_texts) payload.custom_texts = {};
    payload.custom_texts['config.support_type'] = payload.support_type;
    delete payload.support_type;
  }

  // Update app_settings table
  const { error: updateError } = await supabaseAdmin
    .from('app_settings')
    .upsert({ id: 1, ...payload });

  if (updateError) throw updateError;

  // If admin_email is changing, handle user creation
  if (newSettings.admin_email) {
    const email = newSettings.admin_email.toLowerCase();
    
    // Check if user exists in Auth
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const users = listData?.users || [];
    const existingUser = users.find((u: any) => u.email?.toLowerCase() === email);

    if (!existingUser) {
      // Check if profile exists with this email but without auth user (orphaned profile)
      const { data: orphanedProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (orphanedProfile) {
        console.log(`[Admin API] Deleting orphaned profile for ${email} to prevent trigger conflict`);
        await supabaseAdmin.from('profiles').delete().eq('id', orphanedProfile.id);
      }

      console.log(`[Admin API] Creating new admin user: ${email}`);
      const passwordToUse = adminPassword || '123456';
      
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: passwordToUse,
        email_confirm: true,
        user_metadata: { 
          full_name: 'Super Admin',
          temp_password: passwordToUse 
        }
      });

      if (createError) {
        console.error(`[Admin API] Error creating admin user details:`, {
          message: (createError as any).message,
          code: (createError as any).code,
          details: (createError as any).details
        });
      } else if (userData.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: userData.user.id,
          email: email,
          is_admin: true,
          full_name: 'Super Admin'
        }, { onConflict: 'email' });
        console.log(`[Admin API] Profile created for ${email}. Password: ${passwordToUse}`);
      }
    } else {
      // User exists, update password if provided
      if (adminPassword) {
        console.log(`[Admin API] Updating password for existing admin user: ${email}`);
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: adminPassword,
          user_metadata: { ...existingUser.user_metadata, temp_password: adminPassword }
        });
        if (updateAuthError) {
          console.error(`[Admin API] Error updating admin password details:`, updateAuthError);
        }
      }
      
      // Ensure profile is admin
      await supabaseAdmin.from('profiles').upsert({ 
        id: existingUser.id, 
        email: email,
        is_admin: true
      }, { onConflict: 'id' });
    }
  }

  return res.status(200).json({ success: true });
}

async function getFallbackCatalog(settings: any): Promise<any[]> {
  if (Array.isArray(settings?.custom_texts?.hotmart_products_catalog)) {
    return settings.custom_texts.hotmart_products_catalog;
  }
  return [];
}

async function saveFallbackCatalog(catalog: any[]): Promise<void> {
  try {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('custom_texts')
      .eq('id', 1)
      .maybeSingle();

    const customTexts = settings?.custom_texts || {};
    customTexts['hotmart_products_catalog'] = catalog;

    await supabaseAdmin
      .from('app_settings')
      .upsert({ id: 1, custom_texts: customTexts }, { onConflict: 'id' });
  } catch (e) {
    console.error('Error saving fallback catalog:', e);
  }
}

async function handleProductsList(req: VercelRequest, res: VercelResponse) {
  try {
    const syncResult = await autoDiscoverProducts();
    return res.status(200).json(syncResult.catalog);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function autoDiscoverProducts(): Promise<{ catalog: any[], migratedCount: number }> {
  let migratedCount = 0;
  let catalog: any[] = [];

  // Parallelize initial queries
  const [productsRes, coursesRes, packagesRes, settingsRes] = await Promise.all([
    (async () => { try { const { data } = await supabaseAdmin.from('hotmart_products').select('*'); return data; } catch { return null; } })(),
    (async () => { try { const { data } = await supabaseAdmin.from('courses').select('id, title, hotmart_product_id, is_free, is_bonus, is_package_exclusive_bonus, checkout_url'); return data; } catch { return null; } })(),
    (async () => { try { const { data } = await supabaseAdmin.from('course_packages').select('id, title, hotmart_product_id'); return data; } catch { return null; } })(),
    (async () => { try { const { data } = await supabaseAdmin.from('app_settings').select('custom_texts').eq('id', 1).maybeSingle(); return data; } catch { return null; } })()
  ]);

  if (productsRes && productsRes.length > 0) {
    catalog = [...productsRes];
  } else {
    catalog = await getFallbackCatalog(settingsRes);
  }

  const courses = coursesRes || [];
  const packages = packagesRes || [];
  const customTexts = settingsRes?.custom_texts || {};

  const courseMap = new Map<string, any>();
  courses.forEach((c: any) => courseMap.set(c.id, c));

  // Clean catalog: remove course items that are now free, bonus, or package-exclusive
  catalog = catalog.filter(item => {
    if (item.product_type === 'course' && item.internal_target_id) {
      const c = courseMap.get(item.internal_target_id);
      if (!c) return false; // Course deleted
      if (c.is_free === true || c.is_bonus === true || c.is_package_exclusive_bonus === true) {
        return false;
      }
      if (item.hotmart_product_id?.startsWith('CURSO_') && (!c.hotmart_product_id || c.hotmart_product_id.trim() === '')) {
        item.hotmart_product_id = '';
      } else if (c.hotmart_product_id && c.hotmart_product_id.trim() !== '') {
        item.hotmart_product_id = c.hotmart_product_id.trim();
      }
    }
    return true;
  });

  const existingHotmartIds = new Set(
    catalog
      .map(p => String(p.hotmart_product_id))
      .filter(id => id.length > 0)
  );
  const existingCourseTargetIds = new Set(
    catalog.filter(p => p.product_type === 'course' && p.internal_target_id).map(p => p.internal_target_id)
  );

  if (courses.length > 0) {
    for (const course of courses) {
      if (course.is_free === true || course.is_bonus === true || course.is_package_exclusive_bonus === true) continue;

      if (!existingCourseTargetIds.has(course.id)) {
        const hId = course.hotmart_product_id ? String(course.hotmart_product_id).trim() : '';
        const item = {
          id: 'prod_' + Math.random().toString(36).substring(2, 9),
          hotmart_product_id: hId,
          name: `Curso: ${course.title}`,
          product_type: 'course',
          internal_target_id: course.id,
          checkout_url: course.checkout_url || '',
          is_active: true,
          created_at: new Date().toISOString()
        };
        catalog.push(item);
        if (hId) existingHotmartIds.add(hId);
        existingCourseTargetIds.add(course.id);
        migratedCount++;
      }
    }
  }

  // 3. Discover Packages
  if (packages.length > 0) {
    for (const pkg of packages) {
      const hId = pkg.hotmart_product_id ? String(pkg.hotmart_product_id).trim() : `PACOTE_${pkg.id.substring(0, 8).toUpperCase()}`;
      if (!existingHotmartIds.has(hId)) {
        const item = {
          id: 'prod_' + Math.random().toString(36).substring(2, 9),
          hotmart_product_id: hId,
          name: `Pacote: ${pkg.title}`,
          product_type: 'package',
          internal_target_id: pkg.id,
          is_active: true,
          created_at: new Date().toISOString()
        };
        catalog.push(item);
        existingHotmartIds.add(hId);
        migratedCount++;
      }
    }
  }

  // 4. Discover Main Product & AI Subscription from Settings
  const mainId = customTexts['hotmart.main_product_id'] ?? customTexts['main_course_hotmart_id'] ?? '';
  const aiId = customTexts['hotmart.unlimited_ai_product_id'] ?? customTexts['hotmart.ai_product_id'] ?? '';

  // Cleanup duplicates in catalog for main_product and ai_subscription
  const mainProductsInCat = catalog.filter(p => p.product_type === 'main_product');
  if (mainProductsInCat.length > 1) {
    const chosenMain = mainProductsInCat.find(p => p.hotmart_product_id && p.hotmart_product_id !== 'HOTMART_PRODUTO_PRINCIPAL') || mainProductsInCat[0];
    const removeHotmartIds = mainProductsInCat.filter(p => p !== chosenMain).map(p => p.hotmart_product_id);
    catalog = catalog.filter(p => p.product_type !== 'main_product' || p === chosenMain);
    for (const staleId of removeHotmartIds) {
      if (staleId) {
        try {
          await supabaseAdmin.from('hotmart_products').delete().eq('hotmart_product_id', staleId);
        } catch (e) {}
      }
    }
  }

  const aiProductsInCat = catalog.filter(p => p.product_type === 'ai_subscription');
  if (aiProductsInCat.length > 1) {
    const chosenAi = aiProductsInCat.find(p => p.hotmart_product_id && p.hotmart_product_id !== 'HOTMART_IA_VICTORIA') || aiProductsInCat[0];
    const removeHotmartIds = aiProductsInCat.filter(p => p !== chosenAi).map(p => p.hotmart_product_id);
    catalog = catalog.filter(p => p.product_type !== 'ai_subscription' || p === chosenAi);
    for (const staleId of removeHotmartIds) {
      if (staleId) {
        try {
          await supabaseAdmin.from('hotmart_products').delete().eq('hotmart_product_id', staleId);
        } catch (e) {}
      }
    }
  }

  const hasMainProduct = catalog.some(p => p.product_type === 'main_product');
  if (!hasMainProduct) {
    const mainItem = {
      id: 'prod_main_default',
      hotmart_product_id: String(mainId),
      name: 'Produto Principal (Acesso Geral à Plataforma)',
      product_type: 'main_product',
      checkout_url: customTexts['hotmart.main_checkout_url'] || customTexts['main_checkout_url'] || '',
      is_active: true,
      created_at: new Date().toISOString()
    };
    catalog.push(mainItem);
    existingHotmartIds.add(String(mainId));
    migratedCount++;
  }

  const hasAiProduct = catalog.some(p => p.product_type === 'ai_subscription');
  if (!hasAiProduct) {
    const aiItem = {
      id: 'prod_ai_default',
      hotmart_product_id: String(aiId),
      name: 'IA Expert VIP (Ilimitada)',
      product_type: 'ai_subscription',
      checkout_url: customTexts['ai_expert.buy_more_url'] || '',
      is_active: true,
      created_at: new Date().toISOString()
    };
    catalog.push(aiItem);
    existingHotmartIds.add(String(aiId));
    migratedCount++;
  }

  // Sanitize product names for AI subscription
  for (const item of catalog) {
    if (item.product_type === 'ai_subscription' || (item.name && item.name.includes('Victoria'))) {
      item.name = item.name
        ? item.name.replace(/IA Victoria VIP \(Ilimitada\)/gi, 'IA Expert VIP (Ilimitada)')
                   .replace(/IA Victoria VIP/gi, 'IA Expert VIP')
                   .replace(/IA Victoria/gi, 'IA Expert')
        : 'IA Expert VIP (Ilimitada)';
    }
  }

  // Only persist to database if new products were discovered
  if (migratedCount > 0) {
    for (const item of catalog) {
      try {
        await supabaseAdmin.from('hotmart_products').upsert({
          hotmart_product_id: item.hotmart_product_id,
          name: item.name,
          product_type: item.product_type,
          internal_target_id: item.internal_target_id || null,
          checkout_url: item.checkout_url || null,
          is_active: item.is_active !== false,
          description: item.description || null
        }, { onConflict: 'hotmart_product_id' });
      } catch (e) {}
    }
    await saveFallbackCatalog(catalog);
  }

  // Sort catalog so main_product is always first
  catalog.sort((a, b) => {
    if (a.product_type === 'main_product') return -1;
    if (b.product_type === 'main_product') return 1;
    return 0;
  });

  return { catalog, migratedCount };
}

async function handleProductSave(req: VercelRequest, res: VercelResponse) {
  try {
    const { id, hotmart_product_id, name, product_type, internal_target_id, checkout_url, is_active, description } = req.body;
    
    if (!name || !product_type) {
      return res.status(400).json({ error: 'Campos obrigatórios: Nome e Tipo do Produto.' });
    }

    const cleanHotmartId = hotmart_product_id ? String(hotmart_product_id).trim() : '';

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nome do produto é obrigatório.' });
    }

    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('custom_texts')
      .eq('id', 1)
      .maybeSingle();

    let catalog = await getFallbackCatalog(settings);

    if (cleanHotmartId) {
      // 1. Check uniqueness in DB table hotmart_products
      try {
        const { data: existingProd } = await supabaseAdmin
          .from('hotmart_products')
          .select('id, name')
          .eq('hotmart_product_id', cleanHotmartId)
          .maybeSingle();

        if (existingProd && existingProd.id !== id) {
          return res.status(400).json({ error: `O ID Hotmart '${cleanHotmartId}' já está cadastrado no produto "${existingProd.name}".` });
        }
      } catch (e) {}

      // 2. Check uniqueness in app_settings fallback catalog
      const existingFallback = catalog.find(p => p.hotmart_product_id && String(p.hotmart_product_id).trim() === cleanHotmartId && p.id !== id);
      if (existingFallback) {
        return res.status(400).json({ error: `O ID Hotmart '${cleanHotmartId}' já está cadastrado no produto "${existingFallback.name}".` });
      }
    }

    const payload: any = {
      id: id || ('prod_' + Math.random().toString(36).substring(2, 9)),
      hotmart_product_id: cleanHotmartId,
      name: String(name).trim(),
      product_type: String(product_type).trim(),
      internal_target_id: internal_target_id ? String(internal_target_id).trim() : null,
      checkout_url: checkout_url ? String(checkout_url).trim() : null,
      is_active: is_active !== false,
      description: description ? String(description).trim() : null,
      updated_at: new Date().toISOString()
    };

    let savedData = payload;

    // Special handling for main_product and ai_subscription
    if (product_type === 'main_product' || product_type === 'ai_subscription') {
      try {
        await supabaseAdmin
          .from('hotmart_products')
          .delete()
          .eq('product_type', product_type)
          .neq('hotmart_product_id', cleanHotmartId);
      } catch (e) {}

      const customTexts = settings?.custom_texts || {};
      if (product_type === 'main_product') {
        customTexts['hotmart.main_product_id'] = cleanHotmartId;
        customTexts['main_course_hotmart_id'] = cleanHotmartId;
      } else {
        customTexts['hotmart.unlimited_ai_product_id'] = cleanHotmartId;
        customTexts['hotmart.ai_product_id'] = cleanHotmartId;
      }
      try {
        await supabaseAdmin
          .from('app_settings')
          .upsert({ id: 1, custom_texts: customTexts }, { onConflict: 'id' });
      } catch (e) {}
    }

    // Try saving to hotmart_products table
    try {
      const { data, error } = await supabaseAdmin
        .from('hotmart_products')
        .upsert(payload, { onConflict: cleanHotmartId ? 'hotmart_product_id' : 'id' })
        .select()
        .single();
      if (!error && data) {
        savedData = data;
      }
    } catch (e) {
      // Table might not exist
    }

    // Also update app_settings fallback catalog
    if (product_type === 'main_product' || product_type === 'ai_subscription') {
      catalog = catalog.filter(p => p.product_type !== product_type && p.id !== payload.id);
      catalog.unshift(payload);
    } else {
      const existingIndex = catalog.findIndex(p => p.id === payload.id || (cleanHotmartId && p.hotmart_product_id === cleanHotmartId));
      if (existingIndex >= 0) {
        catalog[existingIndex] = { ...catalog[existingIndex], ...payload };
      } else {
        catalog.unshift(payload);
      }
    }
    await saveFallbackCatalog(catalog);

    // Also sync hotmart_product_id to course / package if targeted
    if (product_type === 'course' && internal_target_id) {
      try {
        await supabaseAdmin
          .from('courses')
          .update({ hotmart_product_id: payload.hotmart_product_id })
          .eq('id', internal_target_id);
      } catch (e) {}
    } else if (product_type === 'package' && internal_target_id) {
      try {
        await supabaseAdmin
          .from('course_packages')
          .update({ hotmart_product_id: payload.hotmart_product_id })
          .eq('id', internal_target_id);
      } catch (e) {}
    }

    return res.status(200).json({ success: true, product: savedData });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleProductDelete(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID do produto é obrigatório.' });

    // Prevent deleting main_product
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('custom_texts')
      .eq('id', 1)
      .maybeSingle();

    let catalog = await getFallbackCatalog(settings);
    const targetProd = catalog.find(p => p.id === id || p.hotmart_product_id === id);

    if (targetProd?.product_type === 'main_product') {
      return res.status(400).json({ error: 'O Produto Principal é obrigatório e não pode ser excluído.' });
    }

    try {
      await supabaseAdmin
        .from('hotmart_products')
        .delete()
        .eq('id', id);
    } catch (e) {}

    // Also remove from fallback
    catalog = catalog.filter(p => p.id !== id && p.hotmart_product_id !== id);
    await saveFallbackCatalog(catalog);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleProductSyncMigration(req: VercelRequest, res: VercelResponse) {
  try {
    const result = await autoDiscoverProducts();
    return res.status(200).json({ success: true, migratedCount: result.migratedCount, catalog: result.catalog });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleWebhookEventsList(req: VercelRequest, res: VercelResponse) {
  try {
    const { data, error } = await supabaseAdmin
      .from('hotmart_events')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(100);

    if (error) {
      if (error.code === '42P01') {
        return res.status(200).json([]);
      }
      throw error;
    }
    return res.status(200).json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleWebhookSimulate(req: VercelRequest, res: VercelResponse) {
  try {
    const { buyer_email, hotmart_product_id, event_type } = req.body;
    if (!buyer_email || !event_type) {
      return res.status(400).json({ error: 'E-mail do comprador e tipo de evento são obrigatórios.' });
    }

    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('custom_texts')
      .eq('id', 1)
      .maybeSingle();

    const configuredToken = process.env.HOTMART_WEBHOOK_TOKEN || settings?.custom_texts?.['hotmart.webhook_token'] || 'SIMULATION_TOKEN';
    let targetWebhookUrl = settings?.custom_texts?.['hotmart.webhook_url'];

    // Fallback para URL do Supabase do ambiente se a URL configurada não for fornecida ou for um placeholder
    const envSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const isPlaceholderUrl = (url: string) => /SEU_SUPABASE|SEU_PROJETO|your-project|example\.com|<.*>|YOUR_/i.test(url);

    if ((!targetWebhookUrl || isPlaceholderUrl(targetWebhookUrl)) && envSupabaseUrl && !isPlaceholderUrl(envSupabaseUrl)) {
      targetWebhookUrl = `${envSupabaseUrl.replace(/\/$/, '')}/functions/v1/hotmart-webhook`;
    }

    // Resolve Product Name and Type accurately for Simulation
    const configuredMainId = settings?.custom_texts?.['hotmart.main_product_id'] || settings?.custom_texts?.['main_course_hotmart_id'];
    let resolvedHotmartId = hotmart_product_id ? String(hotmart_product_id).trim() : '';
    if (!resolvedHotmartId && configuredMainId) {
      resolvedHotmartId = String(configuredMainId).trim();
    }

    if (!resolvedHotmartId) {
      const { data: mainProd } = await supabaseAdmin
        .from('hotmart_products')
        .select('hotmart_product_id')
        .eq('product_type', 'main_product')
        .maybeSingle();
      if (mainProd?.hotmart_product_id) {
        resolvedHotmartId = String(mainProd.hotmart_product_id).trim();
      }
    }

    let resolvedProductName = 'Produto Hotmart (Simulação)';
    let resolvedProductType = 'main_product';

    if (resolvedHotmartId) {
      // 1. DB hotmart_products
      const { data: dbProd } = await supabaseAdmin
        .from('hotmart_products')
        .select('name, product_type')
        .eq('hotmart_product_id', resolvedHotmartId)
        .maybeSingle();

      if (dbProd?.name) {
        resolvedProductName = dbProd.name;
        resolvedProductType = dbProd.product_type || 'main_product';
      } else {
        // 2. Fallback catalog
        const catalog = await getFallbackCatalog(settings);
        const catProd = catalog.find(p => String(p.hotmart_product_id).trim() === resolvedHotmartId);
        if (catProd?.name) {
          resolvedProductName = catProd.name;
          resolvedProductType = catProd.product_type || 'main_product';
        } else {
          // 3. Courses
          const { data: cMatch } = await supabaseAdmin
            .from('courses')
            .select('title')
            .eq('hotmart_product_id', resolvedHotmartId)
            .maybeSingle();
          if (cMatch?.title) {
            resolvedProductName = cMatch.title;
            resolvedProductType = 'course';
          } else {
            // Check if main product setting matches
            if (configuredMainId && String(configuredMainId).trim() === resolvedHotmartId) {
              resolvedProductName = 'Acesso Geral à Plataforma (Produto Principal)';
              resolvedProductType = 'main_product';
            }
          }
        }
      }
    }

    const hotmartProductIdNum = isNaN(Number(resolvedHotmartId)) ? 0 : Number(resolvedHotmartId);
    const mockPayload = {
      id: 'SIM_' + (Math.random().toString(36).substring(2, 10)),
      creation_date: Date.now(),
      event: event_type || 'PURCHASE_APPROVED',
      version: '2.0.0',
      data: {
        product: {
          id: hotmartProductIdNum,
          ucode: String(resolvedHotmartId || 'main_product'),
          name: resolvedProductName,
          has_co_production: false,
          is_physical_product: false
        },
        buyer: {
          email: buyer_email,
          name: 'Cliente Teste Simulação',
          first_name: 'Cliente',
          last_name: 'Teste',
          checkout_phone_code: '55',
          checkout_phone: '11999999999'
        },
        producer: {
          name: 'Minha Empresa',
          document: '00000000000',
          legal_nature: 'Pessoa Física'
        },
        purchase: {
          approved_date: Date.now(),
          order_date: Date.now(),
          status: event_type === 'PURCHASE_REFUNDED' || event_type === 'PURCHASE_CANCELED' ? 'REFUNDED' : 'APPROVED',
          transaction: 'HP' + Math.floor(Math.random() * 100000000000),
          price: {
            value: 97,
            currency_value: 'BRL'
          },
          full_price: {
            value: 97,
            currency_value: 'BRL'
          },
          payment: {
            installments_number: 1,
            type: 'PIX'
          },
          checkout_country: {
            name: 'Brasil',
            iso: 'BR'
          },
          offer: {
            code: 'SIMULATION'
          },
          business_model: 'I',
          is_funnel: false
        }
      },
      hottok: configuredToken,
      is_simulation: true
    };

    // Auto-record in sales table for simulation trace
    try {
      const isAppr = (event_type || '').includes('APPROVED');
      const isRef = (event_type || '').includes('REFUND');
      const saleStatus = isAppr ? 'approved' : isRef ? 'refunded' : 'canceled';

      await supabaseAdmin.from('sales').upsert({
        transaction_id: mockPayload.data.purchase.transaction,
        buyer_name: mockPayload.data.buyer.name,
        buyer_email: buyer_email,
        buyer_phone: '11999999999',
        product_id: String(resolvedHotmartId),
        product_name: resolvedProductName,
        product_type: resolvedProductType,
        amount: 97,
        currency: 'BRL',
        payment_type: 'PIX',
        status: saleStatus,
        event_type: event_type,
        purchase_date: new Date().toISOString(),
        raw_payload: mockPayload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'transaction_id' });
    } catch (e) {}

    // Process simulation directly in local database first
    let localResult: any = null;
    try {
      const isAppr = (event_type || '').includes('APPROVED');
      if (isAppr) {
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .ilike('email', buyer_email)
          .maybeSingle();

        if (existingProfile) {
          await supabaseAdmin
            .from('profiles')
            .update({ 
              has_access: true, 
              has_unlimited_ai: resolvedProductType === 'ai_subscription',
              updated_at: new Date().toISOString() 
            })
            .eq('id', existingProfile.id);
        }
      }
      localResult = { success: true, message: `Status de simulação atualizado para ${buyer_email}` };
    } catch (localErr: any) {
      console.warn('[handleWebhookSimulate] Local processing warning:', localErr.message);
    }

    // O simulador realiza estritamente o disparo por HTTP POST para o endpoint do Webhook configurado
    if (!targetWebhookUrl || typeof targetWebhookUrl !== 'string' || !targetWebhookUrl.trim().startsWith('http') || isPlaceholderUrl(targetWebhookUrl)) {
      return res.status(200).json({
        success: true,
        http_status: 200,
        simulated_via: 'local_database_and_http',
        target_url: targetWebhookUrl || 'Nenhuma URL configurada',
        sent_hottok: configuredToken,
        sent_payload: mockPayload,
        result: localResult || { message: 'Simulado com sucesso no banco local.' }
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const headersToSend: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-hotmart-hottok': configuredToken,
        'x-simulation': 'true'
      };

      if (supabaseAnonKey) {
        headersToSend['apikey'] = supabaseAnonKey;
        headersToSend['Authorization'] = `Bearer ${supabaseAnonKey}`;
      }

      const edgeRes = await fetch(targetWebhookUrl.trim(), {
        method: 'POST',
        headers: headersToSend,
        body: JSON.stringify(mockPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const edgeText = await edgeRes.text();
      let edgeJson: any = {};
      try {
        edgeJson = JSON.parse(edgeText);
      } catch {
        edgeJson = { raw: edgeText };
      }

      return res.status(200).json({
        success: edgeRes.ok,
        http_status: edgeRes.status,
        simulated_via: 'edge_function_url',
        target_url: targetWebhookUrl,
        sent_hottok: configuredToken,
        sent_payload: mockPayload,
        result: edgeJson,
        ...(!edgeRes.ok ? {
          error: `O Endpoint respondeu com código HTTP ${edgeRes.status}. Por favor, verifique a URL do Endpoint do Webhook (Hotmart).`
        } : {})
      });
    } catch (edgeErr: any) {
      const edgeFetchError = edgeErr.name === 'AbortError' ? 'Timeout de 8s excedido ao conectar com o Endpoint do Webhook' : edgeErr.message;

      return res.status(200).json({
        success: false,
        http_status: 502,
        simulated_via: 'edge_function_url',
        target_url: targetWebhookUrl,
        sent_hottok: configuredToken,
        sent_payload: mockPayload,
        error: 'Falha ao conectar na URL: NetworkError when attempting to fetch resource. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".',
        result: {
          error: 'Falha ao conectar na URL: NetworkError when attempting to fetch resource. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".',
          details: edgeFetchError,
          tip: 'Atenção: Por favor, verifique se a "URL do Endpoint do Webhook (Hotmart)" informada no painel está correta, ativa e acessível.'
        }
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleSalesList(req: VercelRequest, res: VercelResponse) {
  try {
    const startDate = (req.query.startDate as string) || (req.body?.startDate as string) || '';
    const endDate = (req.query.endDate as string) || (req.body?.endDate as string) || '';
    const productId = (req.query.productId as string) || (req.body?.productId as string) || 'all';
    const productType = (req.query.productType as string) || (req.body?.productType as string) || 'all';
    const status = (req.query.status as string) || (req.body?.status as string) || 'all';
    const paymentType = (req.query.paymentType as string) || (req.body?.paymentType as string) || 'all';
    const search = (req.query.search as string) || (req.body?.search as string) || '';

    let salesData: any[] = [];
    let isFromEventsFallback = false;

    try {
      let query = supabaseAdmin.from('sales').select('*').order('purchase_date', { ascending: false });

      if (startDate) query = query.gte('purchase_date', startDate);
      if (endDate) query = query.lte('purchase_date', endDate);
      if (productId && productId !== 'all') query = query.eq('product_id', productId);
      if (productType && productType !== 'all') query = query.eq('product_type', productType);
      if (status && status !== 'all') query = query.eq('status', status);
      if (paymentType && paymentType !== 'all') query = query.eq('payment_type', paymentType.toUpperCase());

      const { data, error } = await query;

      if (error) {
        console.warn('[Admin API] Sales query returned error, using hotmart_events fallback:', error);
        isFromEventsFallback = true;
      } else {
        salesData = data || [];
        if (salesData.length === 0) {
          isFromEventsFallback = true;
        }
      }
    } catch (e: any) {
      console.warn('[Admin API] Sales query exception, using hotmart_events fallback:', e);
      isFromEventsFallback = true;
    }

    if (isFromEventsFallback) {
      let configuredMainId = '';
      try {
        const { data: settingsRow } = await supabaseAdmin.from('app_settings').select('custom_texts').eq('id', 1).maybeSingle();
        configuredMainId = settingsRow?.custom_texts?.['hotmart.main_product_id'] || settingsRow?.custom_texts?.['main_course_hotmart_id'] || '';
      } catch (err) {}

      let events: any[] = [];
      try {
        const { data: eventsData } = await supabaseAdmin
          .from('hotmart_events')
          .select('*')
          .order('processed_at', { ascending: false })
          .limit(500);
        events = eventsData || [];
      } catch (err) {}

      const mappedFromEvents: Map<string, any> = new Map();

      events.forEach((ev: any) => {
        const payload = ev.payload || {};
        const trxId = ev.transaction_id || payload.data?.purchase?.transaction || ('TRX_' + ev.id);
        const eventName = ev.event || payload.event || 'PURCHASE_APPROVED';

        const isAppr = eventName.includes('APPROVED') || eventName.includes('COMPLETE') || eventName.includes('ACTIVATED') || eventName.includes('APROVAD') || eventName === 'SUBSCRIPTION_RENEWAL';
        const isRef = eventName.includes('REFUND') || eventName.includes('REEMBOLS');
        const isCanc = eventName.includes('CANCEL');
        const isCb = eventName.includes('CHARGEBACK');

        const saleStatus = isAppr ? 'approved' : isRef ? 'refunded' : isCanc ? 'canceled' : isCb ? 'chargeback' : 'approved';
        const hProdId = ev.hotmart_product_id || configuredMainId;
        const pName = payload.data?.product?.name || (hProdId ? ('Produto Hotmart (' + hProdId + ')') : 'Produto Principal');
        const val = Number(payload.data?.purchase?.price?.value ?? payload.data?.purchase?.full_price?.value ?? payload.price ?? 97) || 0;
        const cur = String(payload.data?.purchase?.price?.currency_value ?? payload.currency ?? 'BRL').toUpperCase();
        const payType = String(payload.data?.purchase?.payment?.type ?? payload.payment_type ?? 'PIX').toUpperCase();

        const pType = (configuredMainId && String(ev.hotmart_product_id) === String(configuredMainId)) || !ev.hotmart_product_id ? 'main_product' : 'course';

        if (productId && productId !== 'all' && hProdId !== productId) return;
        if (productType && productType !== 'all' && pType !== productType) return;
        if (status && status !== 'all' && saleStatus !== status) return;
        if (paymentType && paymentType !== 'all' && payType !== paymentType.toUpperCase()) return;

        mappedFromEvents.set(trxId, {
          id: ev.id,
          transaction_id: trxId,
          buyer_name: payload.data?.buyer?.name || payload.data?.buyer?.first_name || 'Comprador Hotmart',
          buyer_email: ev.buyer_email || payload.data?.buyer?.email || 'aluno@email.com',
          buyer_phone: payload.data?.buyer?.checkout_phone || null,
          product_id: hProdId || 'main_product',
          product_name: pName,
          product_type: pType,
          amount: val,
          currency: cur,
          payment_type: payType,
          status: saleStatus,
          event_type: eventName,
          purchase_date: ev.processed_at || new Date().toISOString(),
          raw_payload: payload,
          created_at: ev.processed_at || new Date().toISOString()
        });
      });

      salesData = Array.from(mappedFromEvents.values());
    }

    // Filter in-memory for search query
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      salesData = salesData.filter(s =>
        s.buyer_email?.toLowerCase().includes(q) ||
        s.buyer_name?.toLowerCase().includes(q) ||
        s.transaction_id?.toLowerCase().includes(q) ||
        s.product_name?.toLowerCase().includes(q)
      );
    }

    // Compute Metrics
    let totalRevenue = 0;
    let totalCount = 0;
    let refundCount = 0;
    let cancelCount = 0;

    const statusCounts: Record<string, { count: number; total: number }> = {};
    const productStats: Record<string, { name: string; type: string; count: number; total: number }> = {};
    const paymentStats: Record<string, { count: number; total: number }> = {};

    salesData.forEach(s => {
      const st = s.status || 'approved';
      const amt = Number(s.amount) || 0;

      if (!statusCounts[st]) statusCounts[st] = { count: 0, total: 0 };
      statusCounts[st].count += 1;
      statusCounts[st].total += amt;

      if (st === 'approved') {
        totalRevenue += amt;
        totalCount += 1;

        const prodKey = s.product_id || s.product_name;
        if (!productStats[prodKey]) {
          productStats[prodKey] = { name: s.product_name, type: s.product_type, count: 0, total: 0 };
        }
        productStats[prodKey].count += 1;
        productStats[prodKey].total += amt;

        const payKey = s.payment_type || 'PIX';
        if (!paymentStats[payKey]) {
          paymentStats[payKey] = { count: 0, total: 0 };
        }
        paymentStats[payKey].count += 1;
        paymentStats[payKey].total += amt;
      } else if (st === 'refunded') {
        refundCount += 1;
      } else if (st === 'canceled') {
        cancelCount += 1;
      }
    });

    const averageTicket = totalCount > 0 ? (totalRevenue / totalCount) : 0;
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      sales: salesData,
      metrics: {
        totalRevenue,
        totalCount,
        averageTicket,
        refundCount,
        cancelCount,
        statusDistribution: statusCounts,
        topProducts,
        paymentTypeDistribution: paymentStats
      }
    });

  } catch (err: any) {
    console.error('[Admin API] Error in handleSalesList:', err);
    return res.status(200).json({
      success: true,
      sales: [],
      metrics: {
        totalRevenue: 0,
        totalCount: 0,
        averageTicket: 0,
        refundCount: 0,
        cancelCount: 0,
        statusDistribution: {},
        topProducts: [],
        paymentTypeDistribution: {}
      }
    });
  }
}
