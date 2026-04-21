import { supabase } from './supabase';

/**
 * Creates an internal notification for a user
 */
export async function createNotification(userId: string, title: string, message: string) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body: message,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

/**
 * Sends a broadcast notification to all users who have interacted with the app
 */
export async function sendBroadcastNotification(title: string, message: string) {
  try {
    // Get all unique user IDs from posts and purchases
    const { data: postsData } = await supabase.from('community_posts').select('user_id');
    const { data: purchasesData } = await supabase.from('purchases').select('user_id');
    
    const allUserIds = Array.from(new Set([
      ...(postsData?.map(p => p.user_id) || []),
      ...(purchasesData?.map(p => p.user_id) || [])
    ]));

    if (allUserIds.length === 0) return false;

    const notifications = allUserIds.map(uid => ({
      user_id: uid,
      title,
      body: message,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error sending broadcast:', error);
    return false;
  }
}
