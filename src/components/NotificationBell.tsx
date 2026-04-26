import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Notification } from '../lib/supabase';
import { Bell, X, Check, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';

interface NotificationBellProps {
  user: User;
}

export default function NotificationBell({ user }: NotificationBellProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get date locale based on settings
  const dateLocale = useMemo(() => {
    const lang = settings.custom_texts?.['app.language'] || 'pt';
    switch (lang) {
      case 'en': return enUS;
      case 'es': return es;
      default: return ptBR;
    }
  }, [settings.custom_texts]);

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
        .select(`
          *,
          broadcast:notification_broadcasts!broadcast_id (
            type
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Filter out notifications that are only for tracking push purposes
      const filteredData = (data as any[] || []).filter(n => {
        // If there's no associated broadcast (older ones or manual), show them
        if (!n.broadcast) return true;
        // Only show in the bell if it's 'in_app' or 'both'
        return n.broadcast.type === 'in_app' || n.broadcast.type === 'both';
      });

      setNotifications(filteredData);
      setUnreadCount(filteredData.filter(n => !n.is_read).length || 0);
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
        .update({ is_read: true, read_at: new Date().toISOString() })
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
        .update({ is_read: true, read_at: new Date().toISOString() })
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
                  <h3 className="font-black text-lg uppercase tracking-tighter">{t('notifications.title') || 'Notificações'}</h3>
                </div>
                <div className="flex items-center gap-4">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] text-primary hover:underline font-black uppercase tracking-widest"
                    >
                      {t('notifications.clear_all') || 'Limpar tudo'}
                    </button>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)} 
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
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
                    <p className="text-base font-medium">{t('notifications.empty') || 'Você está em dia!'}</p>
                    <p className="text-sm opacity-60">{t('notifications.empty_desc') || 'Nenhuma notificação por aqui.'}</p>
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
                              className="group/btn flex items-center gap-2 pl-3 pr-4 py-2 bg-primary/10 text-primary rounded-full hover:bg-primary hover:text-white transition-all overflow-hidden"
                              title={t('notifications.mark_as_read') || 'Marcar como lida'}
                            >
                              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                {t('notifications.mark_as_read') || 'marcar como lida'}
                              </span>
                              <Check size={14} className="shrink-0" />
                            </button>
                          )}
                        </div>
                        <p className={`text-sm leading-relaxed mb-3 ${!notification.is_read ? 'text-gray-200' : 'text-gray-500'}`}>
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                          <Info size={12} />
                          {format(new Date(notification.created_at), 'PPp', { locale: dateLocale })}
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
                  {t('notifications.close') || 'Fechar Painel'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
