import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, User as UserIcon, RefreshCw, Copy, Check, AlertCircle, Loader2, GraduationCap, ArrowLeft, Clock, Lock, ExternalLink, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AiAssistantModalProps {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  isOpen?: boolean;
  onClose?: () => void;
  hasUnlimitedAi?: boolean;
}

const DEFAULT_AVATAR = 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.png';

const DEFAULT_QUICK_PROMPTS = [
  'How to improve communication with my partner?',
  'Ways to rebuild trust after a disagreement',
  'How to set healthy emotional boundaries',
  'Navigating long-distance relationship challenges'
];

export default function AiAssistantModal({ userId, userEmail, userName, userAvatar, isOpen: externalIsOpen, onClose: externalOnClose, hasUnlimitedAi }: AiAssistantModalProps) {
  const { settings } = useSettings();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Custom AI Expert settings from custom_texts
  const isAiEnabled = settings?.custom_texts?.['ai_expert.enabled'] !== 'false';
  const isLimitEnabled = settings?.custom_texts?.['ai_expert.enable_message_limit'] === 'true';
  const maxMessages = Math.max(1, parseInt(settings?.custom_texts?.['ai_expert.max_messages_count'] || '3', 10));
  const frequency = settings?.custom_texts?.['ai_expert.limit_frequency'] || 'daily';
  
  const limitTitle = settings?.custom_texts?.['ai_expert.limit_reached_title'] || 'Message Limit Reached';
  const limitReachedMsg = settings?.custom_texts?.['ai_expert.limit_reached_message'] || 'You have reached your message limit for this period. Upgrade your plan or try again later.';
  const buyMoreButtonText = settings?.custom_texts?.['ai_expert.buy_more_button_text'] || 'Upgrade to Unlimited Monthly';
  const buyMoreUrl = settings?.custom_texts?.['ai_expert.buy_more_url'] || '';
  const benefit1 = settings?.custom_texts?.['ai_expert.benefit_1'] || 'Unlimited messages 24 hours a day, 7 days a week';
  const benefit2 = settings?.custom_texts?.['ai_expert.benefit_2'] || 'Instant access with zero commitments';
  const errorMessage = settings?.custom_texts?.['ai_expert.error_message'] || 'Sorry, I am unable to connect right now. Please try again shortly.';
  const limitToast = settings?.custom_texts?.['ai_expert.limit_reached_toast'] || 'You have reached your message limit for this period.';
  const copiedToast = settings?.custom_texts?.['ai_expert.copied_toast'] || 'Response copied!';
  const inputDisabledPlaceholder = settings?.custom_texts?.['ai_expert.input_disabled_placeholder'] || 'Message limit reached for this period.';

  const expertName = settings?.custom_texts?.['ai_expert.name'] || 'Victoria';
  const expertSubtitle = settings?.custom_texts?.['ai_expert.subtitle'] || 'Psychologist & Relationship Expert';
  const expertAvatar = (settings?.custom_texts?.['ai_expert.avatar_url'] && settings.custom_texts['ai_expert.avatar_url'].trim())
    ? settings.custom_texts['ai_expert.avatar_url'].trim()
    : DEFAULT_AVATAR;
  const customWelcome = settings?.custom_texts?.['ai_expert.welcome_message'];
  const typingText = settings?.custom_texts?.['ai_expert.typing_indicator'] || `${expertName} is typing...`;
  const inputPlaceholder = settings?.custom_texts?.['ai_expert.input_placeholder'] || `Ask ${expertName}...`;
  const enableQuickPrompts = settings?.custom_texts?.['ai_expert.enable_quick_prompts'] === 'true';
  const systemPromptContext = settings?.custom_texts?.['ai_expert.system_prompt'] || '';

  const quickPromptsRaw = settings?.custom_texts?.['ai_expert.quick_prompts'];
  const quickPrompts = quickPromptsRaw && quickPromptsRaw.trim()
    ? quickPromptsRaw.split('\n').map(p => p.trim()).filter(Boolean)
    : DEFAULT_QUICK_PROMPTS;

  const defaultWelcomeText = customWelcome && customWelcome.trim()
    ? customWelcome
    : `Hello${userName ? `, ${userName}` : ''}! ❤️ I’m Victoria Hayes, your Relationship Expert.\n\nWhatever is happening between you and him, you don’t have to figure it out alone.\n\nTell me what’s going on — what he said, what he did, how things have changed, or what you’re hoping will happen.\n\nI’m here to help with whatever you need, and together, we’ll figure out what’s happening and what to do next. 💕`;

  const resetChatWelcome = settings?.custom_texts?.['ai_expert.reset_chat_welcome'] || `Chat reset! ❤️ I'm ${expertName}, how can I help you now?`;

  // Message Limit Storage and Checks per User (Synced with Supabase + LocalStorage fallback)
  const getStorageKey = (): string => {
    if (userId && userId.trim()) return `ai_expert_sent_messages_history_${userId.trim()}`;
    if (userName && userName.trim()) return `ai_expert_sent_messages_history_${userName.trim()}`;
    return 'ai_expert_sent_messages_history_guest';
  };

  const getSentMessageTimestamps = (): number[] => {
    try {
      const key = getStorageKey();
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const recordSentTimestamp = (): number => {
    const ts = Date.now();
    try {
      const key = getStorageKey();
      const list = getSentMessageTimestamps();
      list.push(ts);
      localStorage.setItem(key, JSON.stringify(list));

      if (isSupabaseConfigured && supabase && userId && userId.trim()) {
        supabase
          .from('ai_message_logs')
          .insert({
            user_id: userId.trim(),
            created_at: new Date(ts).toISOString()
          })
          .then(({ error }) => {
            if (error) {
              console.warn('[AI Expert] Supabase ai_message_logs insert warning:', error.message);
            }
          })
          .catch((err) => {
            console.warn('[AI Expert] Supabase ai_message_logs catch:', err);
          });
      }
    } catch (e) {
      console.error(e);
    }
    return ts;
  };

  const removeSentTimestamp = (ts: number) => {
    try {
      const key = getStorageKey();
      const list = getSentMessageTimestamps().filter(t => t !== ts);
      localStorage.setItem(key, JSON.stringify(list));

      if (isSupabaseConfigured && supabase && userId && userId.trim()) {
        const isoString = new Date(ts).toISOString();
        supabase
          .from('ai_message_logs')
          .delete()
          .eq('user_id', userId.trim())
          .eq('created_at', isoString)
          .then(() => {})
          .catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [sentTimestamps, setSentTimestamps] = useState<number[]>(getSentMessageTimestamps);

  // VIP Unlimited Status Check
  const [isUserUnlimited, setIsUserUnlimited] = useState<boolean>(() => {
    if (hasUnlimitedAi) return true;
    return false;
  });
  const [isCheckingVip, setIsCheckingVip] = useState<boolean>(false);

  useEffect(() => {
    if (userId && isSupabaseConfigured && supabase) {
      checkUserVipStatus(false);
    } else if (hasUnlimitedAi) {
      setIsUserUnlimited(true);
    } else {
      setIsUserUnlimited(false);
    }
  }, [hasUnlimitedAi, userId]);

  const checkUserVipStatus = async (showToastOnCheck = false) => {
    if (!userId || !userId.trim()) {
      setIsUserUnlimited(false);
      if (showToastOnCheck) toast.info('Nenhuma conta detectada. Garanta seu acesso VIP!');
      return;
    }
    const cleanId = userId.trim();
    if (showToastOnCheck) setIsCheckingVip(true);

    try {
      // Query Supabase profiles & purchases table for live status
      if (isSupabaseConfigured && supabase) {
        const isUUID = (str: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        let profileData: { has_unlimited_ai?: boolean; is_admin?: boolean; email?: string } | null = null;

        if (isUUID(cleanId)) {
          const { data } = await supabase
            .from('profiles')
            .select('has_unlimited_ai, is_admin, email')
            .eq('id', cleanId)
            .maybeSingle();
          profileData = data;
        }

        if (!profileData && (cleanId.includes('@') || userEmail)) {
          const emailToFind = (userEmail || cleanId).toLowerCase();
          const { data } = await supabase
            .from('profiles')
            .select('has_unlimited_ai, is_admin, email')
            .eq('email', emailToFind)
            .maybeSingle();
          profileData = data;
        }

        let isUnlimited = false;

        if (profileData) {
          if (profileData.has_unlimited_ai === false) {
            isUnlimited = false;
          } else if (profileData.has_unlimited_ai === true) {
            isUnlimited = true;
          } else {
            const emailToFind = profileData.email || userEmail;
            let q = supabase.from('purchases').select('id');
            if (emailToFind) {
              q = q.or(`user_id.eq.${cleanId},user_id.ilike.${emailToFind}`);
            } else {
              q = q.eq('user_id', cleanId);
            }
            const { data: pRes } = await q.in('product_id', ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited']).maybeSingle();
            isUnlimited = !!pRes;
          }
        } else {
          isUnlimited = Boolean(hasUnlimitedAi);
        }

        setIsUserUnlimited(isUnlimited);

        try {
          localStorage.removeItem(`unlimited_ai_user_${cleanId}`);
          if (profileData?.email) {
            localStorage.removeItem(`unlimited_ai_user_${profileData.email}`);
          }
        } catch (e) {}

        if (showToastOnCheck) {
          if (isUnlimited) {
            toast.success('Acesso VIP Ilimitado verificado com sucesso! 🎉 Você pode conversar sem limites.');
          } else {
            toast.info('Nenhuma assinatura VIP ativa encontrada no momento.');
          }
        }
      } else {
        setIsUserUnlimited(hasUnlimitedAi || false);
      }
    } catch (err) {
      console.warn('VIP Check Note:', err);
    } finally {
      if (showToastOnCheck) setIsCheckingVip(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncLogs = async () => {
      // 1. Immediately load local storage cache for instant rendering
      const localList = getSentMessageTimestamps();
      setSentTimestamps(localList);

      // 2. If user is logged in & Supabase is configured, fetch real records from database
      if (isOpen && isSupabaseConfigured && supabase && userId && userId.trim()) {
        try {
          const { data, error } = await supabase
            .from('ai_message_logs')
            .select('created_at')
            .eq('user_id', userId.trim());

          if (!error && data && Array.isArray(data)) {
            const dbTimestamps = data
              .map((item: { created_at: string }) => new Date(item.created_at).getTime())
              .filter(t => !isNaN(t));

            if (isMounted) {
              setSentTimestamps(dbTimestamps);
              // Save to localStorage as fallback cache
              try {
                const key = getStorageKey();
                localStorage.setItem(key, JSON.stringify(dbTimestamps));
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn('[AI Expert] Supabase logs sync note:', err);
        }
      }
    };

    if (isOpen) {
      syncLogs();
      if (userId) {
        checkUserVipStatus(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, userName]);

  const getMessagesSentInWindow = (timestamps: number[], freq: string): number => {
    const now = new Date();
    
    if (freq === 'daily') {
      // Calendar day reset (resets at 00:00:00 AM local time on the next day)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return timestamps.filter(ts => ts >= startOfToday).length;
    } else if (freq === 'weekly') {
      // Calendar week reset (resets at 00:00:00 AM on Monday of current week)
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).getTime();
      return timestamps.filter(ts => ts >= startOfWeek).length;
    } else if (freq === 'monthly') {
      // Calendar month reset (resets at 00:00:00 AM on the 1st day of current month)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return timestamps.filter(ts => ts >= startOfMonth).length;
    } else if (freq === 'lifetime') {
      return timestamps.length;
    }

    // Default to daily calendar reset
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return timestamps.filter(ts => ts >= startOfToday).length;
  };

  const messagesSentCount = getMessagesSentInWindow(sentTimestamps, frequency);
  const remainingMessages = Math.max(0, maxMessages - messagesSentCount);
  const isLimitReached = !isUserUnlimited && isLimitEnabled && messagesSentCount >= maxMessages;

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'per day';
      case 'weekly': return 'per week';
      case 'monthly': return 'per month';
      case 'lifetime': return 'total';
      default: return 'per day';
    }
  };

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: defaultWelcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  // Sync welcome message if settings change and conversation hasn't started
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: defaultWelcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  }, [expertName, customWelcome, userName]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    if (isLimitReached) {
      toast.error(limitToast);
      return;
    }

    const sentTs = recordSentTimestamp();
    setSentTimestamps(getSentMessageTimestamps());

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const historyForApi = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/v1/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: historyForApi,
          userContext: { userName, userId, email: userEmail },
          customSystemPrompt: systemPromptContext || undefined,
          expertName: expertName || undefined,
          userId: userId || undefined,
          messagesSentCount
        })
      });

      const data = await res.json();

      if (!res.ok) {
        removeSentTimestamp(sentTs);
        setSentTimestamps(getSentMessageTimestamps());
        if (data.error === 'VIP_REQUIRED' || data.isLimitReached) {
          setIsUserUnlimited(false);
          toast.error(data.message || limitToast);
          return;
        }
        throw new Error(data.error || errorMessage);
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('AI Chat Error:', err);
      removeSentTimestamp(sentTs);
      setSentTimestamps(getSentMessageTimestamps());
      toast.error(err.message || errorMessage);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(copiedToast);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: resetChatWelcome,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  return (
    <AnimatePresence>
      {isOpen && isAiEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          className="fixed inset-0 z-[100] w-full h-full bg-zinc-950 text-white flex flex-col overflow-hidden"
        >
          {/* Top Full Screen Navigation Bar */}
          <div className="flex items-center justify-between px-2.5 sm:px-8 py-2.5 sm:py-4 border-b border-white/10 bg-zinc-900/90 backdrop-blur-md shrink-0 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
              <button
                onClick={handleClose}
                className="p-1 sm:p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-2xl transition-colors flex items-center gap-1 shrink-0"
                title="Back"
              >
                <ArrowLeft size={20} className="sm:w-[22px] sm:h-[22px]" />
              </button>

              <div className="relative shrink-0">
                <img
                  src={expertAvatar}
                  alt={expertName}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-full aspect-square object-cover border-2 border-pink-500/50 shadow-md shadow-pink-500/20 shrink-0"
                  onError={(e) => {
                    // Fallback image if custom image URL fails
                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                  <h3 className="text-white font-bold text-sm sm:text-lg leading-tight truncate">
                    {expertName}
                  </h3>
                  {isUserUnlimited ? (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)] shrink-0 animate-pulse">
                      <Sparkles size={11} className="text-amber-400" />
                      <span>VIP Unlimited</span>
                    </span>
                  ) : isLimitEnabled ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 shrink-0">
                      <Clock size={11} className="text-rose-400" />
                      <span>{messagesSentCount}/{maxMessages} {getFrequencyLabel(frequency)}</span>
                    </span>
                  ) : null}
                </div>
                <p className="text-gray-400 text-[10px] sm:text-xs whitespace-nowrap leading-tight">{expertSubtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                onClick={handleClear}
                title="Reset conversation"
                className="p-1.5 sm:p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
              >
                <RefreshCw size={17} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button
                onClick={handleClose}
                title="Close chat"
                className="p-1.5 sm:p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
              >
                <X size={20} className="sm:w-[22px] sm:h-[22px]" />
              </button>
            </div>
          </div>

          {/* Chat Body - Max Width Centered for Large Screens */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 max-w-4xl mx-auto w-full">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {msg.role === 'user' ? (
                  userAvatar && userAvatar.trim() ? (
                    <img
                      src={userAvatar.trim()}
                      alt={userName || 'User'}
                      className="w-9 h-9 rounded-full object-cover border border-rose-500/40 shadow-md shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <UserIcon size={18} />
                    </div>
                  )
                ) : (
                  <img
                    src={expertAvatar}
                    alt={expertName}
                    className="w-9 h-9 rounded-full object-cover border border-pink-500/40 shadow-md shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                  />
                )}

                <div className={`group relative max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 text-sm sm:text-base leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-rose-600 text-white rounded-tr-none'
                    : 'bg-zinc-900 border border-white/10 text-gray-100 rounded-tl-none shadow-lg'
                }`}>
                  <div className="whitespace-pre-wrap font-normal">{msg.content.replace(/\*\*/g, '')}</div>

                  <div className={`flex items-center justify-between mt-3 pt-2 border-t text-[11px] ${
                    msg.role === 'user' ? 'border-white/20 text-rose-200' : 'border-white/10 text-gray-400'
                  }`}>
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleCopy(msg.content.replace(/\*\*/g, ''), msg.id)}
                        className="hover:text-white transition-colors flex items-center gap-1 opacity-60 group-hover:opacity-100"
                        title={copiedId === msg.id ? 'Copied' : 'Copy message'}
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 sm:gap-4"
              >
                <img
                  src={expertAvatar}
                  alt={expertName}
                  className="w-9 h-9 rounded-full object-cover border border-pink-500/40 shadow-md shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                  }}
                />
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm text-gray-300 rounded-tl-none flex items-center gap-2.5">
                  <Loader2 size={18} className="animate-spin text-pink-400" />
                  <span>{typingText}</span>
                </div>
              </motion.div>
            )}

            {isLimitReached && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-auto my-6 max-w-md bg-gradient-to-br from-zinc-900 via-zinc-900 to-rose-950/90 border border-amber-500/30 rounded-3xl p-6 sm:p-7 text-center shadow-2xl shadow-rose-950/60 backdrop-blur-md relative overflow-hidden"
              >
                {/* Decorative background glows */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Header Badge */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30 shadow-sm mb-4">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>VIP Unlimited Plan</span>
                </div>

                <h4 className="text-white font-black text-lg sm:text-xl leading-snug mb-2">
                  {limitTitle || "Unlock Unlimited Conversations"}
                </h4>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-5">
                  {limitReachedMsg || "Get 24/7 unlimited relationship & psychological advice with Victoria, with no daily or monthly message limits."}
                </p>

                {/* Benefits List */}
                <div className="bg-black/50 border border-white/10 rounded-2xl p-3.5 mb-6 text-left space-y-2.5 text-xs text-gray-200">
                  {benefit1 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <Check size={12} />
                      </div>
                      <span>{benefit1}</span>
                    </div>
                  )}
                  {benefit2 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <Check size={12} />
                      </div>
                      <span>{benefit2}</span>
                    </div>
                  )}
                </div>

                {/* Main CTA */}
                <div className="space-y-3">
                  {buyMoreUrl ? (
                    <a
                      href={buyMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xl shadow-pink-500/25 active:scale-95 cursor-pointer"
                    >
                      <Sparkles size={16} />
                      <span>{buyMoreButtonText || "Upgrade to Unlimited Monthly"}</span>
                      <ExternalLink size={14} className="opacity-80" />
                    </a>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 font-medium">
                      Configure the purchase link in Admin Panel &gt; IA Settings to enable instant online checkout!
                    </div>
                  )}

                  {/* Verify / Refresh Button */}
                  <button
                    onClick={() => checkUserVipStatus(true)}
                    disabled={isCheckingVip}
                    className="text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto py-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isCheckingVip ? "animate-spin text-pink-400" : ""} />
                    <span>Already subscribed? Check access</span>
                  </button>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (Only if enabled in Admin and not at limit) */}
          {enableQuickPrompts && messages.length <= 2 && !loading && !isLimitReached && (
            <div className="px-4 py-3 border-t border-white/5 bg-zinc-900/50 max-w-4xl mx-auto w-full flex flex-wrap gap-2">
              <span className="text-xs text-gray-400 w-full mb-1 flex items-center gap-1.5 font-medium">
                <GraduationCap size={15} className="text-pink-400" /> Suggested questions for {expertName}:
              </span>
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-xs bg-zinc-800/90 hover:bg-zinc-700 text-gray-200 hover:text-white border border-white/10 px-3.5 py-2 rounded-xl transition-all text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Footer Input */}
          <div className="p-4 sm:p-6 border-t border-white/10 bg-zinc-900/90 shrink-0">
            <div className="max-w-4xl mx-auto w-full">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2 sm:gap-3"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLimitReached ? inputDisabledPlaceholder : inputPlaceholder}
                  disabled={loading || isLimitReached}
                  className="flex-1 bg-zinc-800/90 border border-white/10 rounded-2xl px-4 sm:px-5 py-3.5 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading || isLimitReached}
                  className="px-5 sm:px-6 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-pink-500/20"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

