import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
    const { data: { user }, error: authError } = await createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    }).auth.getUser();
    
    if (authError || !user) throw new Error('Falha na autenticação');

    // Admin Verification (Double Check)
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, is_admin').eq('id', user.id).single();
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
    
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
      case 'grant-access':
        return await handleGrantAccess(req, res);
      case 'generate-permanent-link':
        return await handleGeneratePermanentLink(req, res);
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
    console.error(`[Admin API] Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleUsersList(req: VercelRequest, res: VercelResponse) {
  try {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
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
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName, phone }
  });
  if (error) throw error;
  if (data.user) {
    await supabaseAdmin.from('profiles').upsert({ id: data.user.id, email, full_name: fullName, phone });
  }
  return res.status(200).json({ success: true, user: data.user });
}

async function handleUserDelete(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id) return res.status(400).json({ error: 'ID required' });
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) throw error;
  await supabaseAdmin.from('profiles').delete().eq('id', id);
  return res.status(200).json({ success: true });
}

async function handleAccessToggle(req: VercelRequest, res: VercelResponse) {
  const { userId, hasAccess } = req.body;
  try {
    const { error } = await supabaseAdmin.from('profiles').update({ has_access: hasAccess }).eq('id', userId);
    if (error) {
      // If column doesn't exist, we don't want to crash the whole admin panel
      if (error.code === '42703') {
        return res.status(200).json({ success: true, warning: 'Coluna has_access não existe no banco de dados. Por favor, execute o SQL em SUPABASE_SETUP.md' });
      }
      throw error;
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[Admin API] Toggle access error:', err);
    return res.status(200).json({ success: true, warning: err.message });
  }
}

async function handleGrantAccess(req: VercelRequest, res: VercelResponse) {
  const { email, courses } = req.body;
  // Simplified logic, usually involves inserting into a many-to-many table
  return res.status(200).json({ success: true });
}

async function handlePurchases(req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabaseAdmin.from('purchases').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  if (error && error.code !== '42P01') throw error;
  return res.status(200).json(data || []);
}

async function handleGeneratePermanentLink(req: VercelRequest, res: VercelResponse) {
  const { userId, email } = req.body;
  
  let targetId = userId;
  if (!targetId && email) {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = userList?.users?.find((u: any) => u.email?.toLowerCase() === (email as string).toLowerCase());
    if (targetUser) targetId = targetUser.id;
  }

  if (!targetId) return res.status(404).json({ error: 'Usuário não encontrado' });

  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const { error } = await supabaseAdmin
    .from('magic_login_tokens')
    .upsert({
      user_id: targetId,
      token,
      active: true,
      created_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw error;

  const baseUrl = process.env.VITE_APP_URL || 'https://app-maternidade2.vercel.app';
  const link = `${baseUrl}?magic=${token}`;
  
  return res.status(200).json({ success: true, link });
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
      const passwordToUse = adminPassword || 'Wilson@2024';
      
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
        console.error(`[Admin API] Error creating admin user:`, createError);
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
        if (updateAuthError) console.error(`[Admin API] Error updating admin password:`, updateAuthError);
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
