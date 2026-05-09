import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, body, userIds } = req.body;
    
    // Log to history
    const { data: broadcast } = await supabaseAdmin
      .from('notification_history')
      .insert({
        title,
        body,
        target_count: userIds?.length || 0,
        status: 'sent',
        type: req.body.type || 'both'
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

    // In a real app, you would call FCM or another service here
    // For now we just return success
    
    return res.status(200).json({ success: true, count: userIds?.length || 0 });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
