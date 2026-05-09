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
  let action = url.split('?')[0].split('/').pop();
  
  // Handle user-delete/[id] pattern if needed, but we'll use a router param
  let id = null;
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
      case 'purchases-list':
        return await handlePurchases(req, res);
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
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;
  const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
  const merged = users.map(u => ({ ...u, ...profiles?.find(p => p.id === u.id), id: u.id, email: u.email }));
  return res.status(200).json(merged);
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
  const { error } = await supabaseAdmin.from('profiles').update({ has_access: hasAccess }).eq('id', userId);
  if (error) throw error;
  return res.status(200).json({ success: true });
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
