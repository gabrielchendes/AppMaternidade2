import { supabase } from './supabase';
import { safeFetch } from './utils';

/**
 * Creates a notification for a user (Internal + Push if available) and tracks in central history
 */
export async function createNotification(userId: string, title: string, message: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Attempt centralized push & tracking
    try {
      const response = await safeFetch('/api/v1/notifications?action=notification-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          title,
          body: message,
          userIds: [userId],
          type: 'both'
        })
      });

      if (response && response.success) {
        return true;
      }
    } catch (apiErr) {
      console.warn('[notifications.ts] Central API fallback:', apiErr);
    }

    // Direct database fallback
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body: message,
      message,
      is_read: false,
      read: false,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

/**
 * Sends a broadcast notification to all users and records in history
 */
export async function sendBroadcastNotification(title: string, message: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // Get all unique user IDs from profiles
    const { data: profiles } = await supabase.from('profiles').select('id');
    let allUserIds = profiles?.map(p => p.id).filter(Boolean) || [];

    if (allUserIds.length === 0) {
      const { data: postsData } = await supabase.from('community_posts').select('user_id');
      const { data: purchasesData } = await supabase.from('purchases').select('user_id');
      allUserIds = Array.from(new Set([
        ...(postsData?.map(p => p.user_id) || []),
        ...(purchasesData?.map(p => p.user_id) || [])
      ])).filter(Boolean);
    }

    if (allUserIds.length === 0) return false;

    // Attempt centralized push & history
    try {
      const response = await safeFetch('/api/v1/notifications?action=notification-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          title,
          body: message,
          userIds: allUserIds,
          type: 'both'
        })
      });

      if (response && response.success) {
        return true;
      }
    } catch (apiErr) {
      console.warn('[notifications.ts] Central API broadcast fallback:', apiErr);
    }

    // Direct fallback
    const broadcastId = `bc_${Date.now()}`;
    const notifications = allUserIds.map(uid => ({
      user_id: uid,
      broadcast_id: broadcastId,
      title,
      body: message,
      message,
      is_read: false,
      read: false,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error sending broadcast:', error);
    return false;
  }
}

