import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) console.error('[Admin API] SUPABASE_URL is missing');
if (!supabaseServiceRoleKey) console.warn('[Admin API] SUPABASE_SERVICE_ROLE_KEY is missing');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

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
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      if (authError) {
        const urlHost = new URL(supabaseUrl).hostname;
        console.error('[Admin API] auth.getUser error:', {
          message: authError.message,
          status: authError.status,
          token_preview: token.substring(0, 10) + '...',
          url_host: urlHost,
          issuer_check: token.includes('fhnmplthlongdfnzbj') ? 'Match' : 'Mismatch?' 
        });
      }
      throw new Error('Falha na autenticação');
    }

    // Admin Verification (Double Check)
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, is_admin').eq('id', user.id).single();
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email, app_url').eq('id', 1).single();
    
    const isHardcodedAdmin = user.email?.toLowerCase() === 'gabrielchendes@gmail.com';
    const isSuperAdmin = (settings?.admin_email && user.email?.toLowerCase() === settings.admin_email.toLowerCase()) || isHardcodedAdmin;
    
    if (!profile?.is_admin && !isSuperAdmin) {
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
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const users = listData?.users || [];
    const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
    const { data: pushTokens } = await supabaseAdmin.from('push_tokens').select('user_id');
    
    const merged = users.map(u => {
      const profile = profiles?.find(p => p.id === u.id);
      const hasPush = Array.isArray(pushTokens) && pushTokens.some(t => t.user_id === u.id);
      return { 
        ...u, 
        ...profile, 
        id: u.id, 
        email: u.email,
        push_enabled: !!hasPush 
      };
    });
    return res.status(200).json(merged);
  } catch (err: any) {
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
  const { userId, hasAccess, courseId, action } = req.body;
  
  try {
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // If courseId and action are present, it's a specific course/package access toggle
    if (courseId && action) {
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
    // 1. Fetch purchases first (optional filter by userId)
    let qBase = supabaseAdmin.from('purchases').select('*');
    if (userId) {
      qBase = qBase.eq('user_id', userId);
    }
    
    const { data: purchases, error: pError } = await qBase.order('created_at', { ascending: false });
    if (pError) throw pError;
    if (!purchases || purchases.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Extract unique user/product IDs for targeted sub-queries
    const userIds = Array.from(new Set(purchases.map(p => p.user_id).filter(Boolean)));
    const productIds = Array.from(new Set(purchases.map(p => p.product_id).filter(Boolean)));

    // 3. Fetch matching profiles, courses, and packages in parallel
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

    // 4. Enrich purchases with fetched data
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

async function handleUpdateSettings(req: VercelRequest, res: VercelResponse) {
  const { settings: newSettings, adminPassword } = req.body;
  if (!newSettings) return res.status(400).json({ error: 'Configurações não fornecidas' });

  // Update app_settings table
  const { error: updateError } = await supabaseAdmin
    .from('app_settings')
    .upsert({ id: 1, ...newSettings });

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
