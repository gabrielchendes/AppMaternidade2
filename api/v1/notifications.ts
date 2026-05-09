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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract path to determine action
  const urlParts = req.url?.split('/') || [];
  const action = urlParts.pop()?.split('?')[0];

  try {
    switch (action) {
      case 'notification-push':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return await handlePush(req, res);
      
      case 'notification-history':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        return await handleHistory(req, res);
      
      case 'notification-clear':
        if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
        return await handleClear(req, res);
        
      case 'notification-details':
        return res.status(200).json([]);

      case 'sub-topic':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return await handleSubTopic(req, res);

      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error: any) {
    console.error(`[Notifications API] Error in ${action}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

async function handlePush(req: VercelRequest, res: VercelResponse) {
  const { title, body, userIds, type = 'both' } = req.body;
  
  // Log to history
  const { data: broadcast } = await supabaseAdmin
    .from('notification_history')
    .insert({
      title,
      body,
      target_count: userIds?.length || 0,
      status: 'sent',
      type
    })
    .select()
    .single();

  // Create internal notifications for each user
  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    const notificationRows = userIds.map(uid => ({
      user_id: uid,
      title,
      body,
      broadcast_id: broadcast?.id || null
    }));

    await supabaseAdmin
      .from('notifications')
      .insert(notificationRows);
  }

  return res.status(200).json({ success: true, count: userIds?.length || 0 });
}

async function handleHistory(req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('notification_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
     if (error.code === '42P01' || error.message?.includes('schema cache')) return res.status(200).json([]);
     throw error;
  }
  return res.status(200).json(data || []);
}

async function handleClear(req: VercelRequest, res: VercelResponse) {
  const { error } = await supabaseAdmin
    .from('notification_history')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error && error.code !== '42P01') throw error;
  return res.status(200).json({ success: true });
}

async function handleSubTopic(req: VercelRequest, res: VercelResponse) {
  const { userId, topic, action } = req.body;
  if (!userId || !topic) return res.status(400).json({ error: 'Missing parameters' });
  
  // Logic for topic subscription...
  return res.status(200).json({ success: true, action });
}
