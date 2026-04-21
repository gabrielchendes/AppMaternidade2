import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Notification } from '../lib/supabase';
import { Bell, X, Check, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationBellProps {
  user: User;
}

export default function NotificationBell({ user }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('user_notifications')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchNotifications()
      )
      .subscribe();

    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user.id]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-all active:scale-95"
      >
        <Bell size={28} className={unreadCount > 0 ? "text-primary animate-pulse" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-[12px] font-black px-1.5 rounded-full min-w-[22px] h-[22px] flex items-center justify-center border-2 border-zinc-900 shadow-lg animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] md:hidden"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-x-4 top-20 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 w-auto md:w-96 bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[1000] max-h-[80vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <Bell size={24} className="text-primary" />
                  <h3 className="font-black text-lg uppercase tracking-tighter">Notificações</h3>
                </div>
                <div className="flex items-center gap-4">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] text-primary hover:underline font-black uppercase tracking-widest"
                    >
                      Limpar tudo
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-500 hover:text-white">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500 px-6 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Bell size={40} className="opacity-20" />
                    </div>
                    <p className="text-base font-medium">Você está em dia!</p>
                    <p className="text-sm opacity-60">Nenhuma notificação por aqui.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={`p-6 transition-all hover:bg-white/5 relative group ${!notification.is_read ? 'bg-primary/10' : ''}`}
                      >
                        {!notification.is_read && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary shadow-[0_0_10px_rgba(236,72,153,0.5)]" />
                        )}
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <h4 className={`text-base font-black leading-tight ${!notification.is_read ? 'text-white' : 'text-gray-400'}`}>
                            {notification.title}
                          </h4>
                          {!notification.is_read && (
                            <button 
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary hover:text-white transition-all"
                              title="Lida"
                            >
                              <Check size={16} />
                            </button>
                          )}
                        </div>
                        <p className={`text-sm leading-relaxed mb-3 ${!notification.is_read ? 'text-gray-200' : 'text-gray-500'}`}>
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                          <Info size={12} />
                          {format(new Date(notification.created_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full py-3 text-xs text-gray-400 hover:text-white font-black uppercase tracking-[0.2em] transition-all"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
