import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, User as UserIcon, RefreshCw, Copy, Check, AlertCircle, Loader2, GraduationCap, ArrowLeft, Clock, Lock, ExternalLink, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AiAssistantModalProps {
  userName?: string;
  userAvatar?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULT_AVATAR = 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.png';

const DEFAULT_QUICK_PROMPTS = [
  'How to improve communication with my partner?',
  'Ways to rebuild trust after a disagreement',
  'How to set healthy emotional boundaries',
  'Navigating long-distance relationship challenges'
];

export default function AiAssistantModal({ userName, userAvatar, isOpen: externalIsOpen, onClose: externalOnClose }: AiAssistantModalProps) {
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
  const buyMoreButtonText = settings?.custom_texts?.['ai_expert.buy_more_button_text'] || 'Buy More Messages';
  const buyMoreUrl = settings?.custom_texts?.['ai_expert.buy_more_url'] || '';
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

  // Message Limit Storage and Checks
  const getSentMessageTimestamps = (): number[] => {
    try {
      const stored = localStorage.getItem('ai_expert_sent_messages_history');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const recordSentTimestamp = (): number => {
    try {
      const ts = Date.now();
      const list = getSentMessageTimestamps();
      list.push(ts);
      localStorage.setItem('ai_expert_sent_messages_history', JSON.stringify(list));
      return ts;
    } catch (e) {
      console.error(e);
      return Date.now();
    }
  };

  const removeSentTimestamp = (ts: number) => {
    try {
      const list = getSentMessageTimestamps().filter(t => t !== ts);
      localStorage.setItem('ai_expert_sent_messages_history', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  };

  const [sentTimestamps, setSentTimestamps] = useState<number[]>(getSentMessageTimestamps);

  useEffect(() => {
    if (isOpen) {
      setSentTimestamps(getSentMessageTimestamps());
    }
  }, [isOpen]);

  const getMessagesSentInWindow = (timestamps: number[], freq: string): number => {
    const now = Date.now();
    if (freq === 'daily') {
      const windowMs = 24 * 60 * 60 * 1000;
      return timestamps.filter(ts => now - ts < windowMs).length;
    } else if (freq === 'weekly') {
      const windowMs = 7 * 24 * 60 * 60 * 1000;
      return timestamps.filter(ts => now - ts < windowMs).length;
    } else if (freq === 'monthly') {
      const windowMs = 30 * 24 * 60 * 60 * 1000;
      return timestamps.filter(ts => now - ts < windowMs).length;
    } else if (freq === 'lifetime') {
      return timestamps.length;
    }
    return timestamps.filter(ts => now - ts < 24 * 60 * 60 * 1000).length;
  };

  const messagesSentCount = getMessagesSentInWindow(sentTimestamps, frequency);
  const remainingMessages = Math.max(0, maxMessages - messagesSentCount);
  const isLimitReached = isLimitEnabled && messagesSentCount >= maxMessages;

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
          userContext: { userName },
          customSystemPrompt: systemPromptContext || undefined,
          expertName: expertName || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        removeSentTimestamp(sentTs);
        setSentTimestamps(getSentMessageTimestamps());
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
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/10 bg-zinc-900/90 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3.5">
              <button
                onClick={handleClose}
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-2xl transition-colors flex items-center gap-1"
                title="Voltar"
              >
                <ArrowLeft size={22} />
              </button>

              <div className="relative">
                <img
                  src={expertAvatar}
                  alt={expertName}
                  className="w-11 h-11 rounded-full object-cover border-2 border-pink-500/50 shadow-md shadow-pink-500/20"
                  onError={(e) => {
                    // Fallback image if custom image URL fails
                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                  }}
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {expertName}
                  </h3>
                  {isLimitEnabled && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      <Clock size={12} className="text-rose-400" />
                      <span>{messagesSentCount}/{maxMessages} {getFrequencyLabel(frequency)}</span>
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs">{expertSubtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                title="Reiniciar conversa"
                className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={handleClose}
                title="Fechar chat"
                className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
              >
                <X size={22} />
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
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copiedId === msg.id ? 'Copiado' : 'Copiar'}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto my-4 max-w-md bg-gradient-to-br from-rose-950/90 via-zinc-900 to-rose-950/90 border border-rose-500/40 rounded-3xl p-6 text-center shadow-2xl backdrop-blur-md"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Lock size={22} />
                </div>
                <h4 className="text-white font-bold text-base mb-1.5">
                  {limitTitle}
                </h4>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-4">
                  {limitReachedMsg}
                </p>
                <div className="inline-flex items-center gap-1.5 text-xs text-rose-300 font-medium bg-rose-500/10 py-1.5 px-3.5 rounded-full border border-rose-500/20">
                  <Clock size={13} />
                  <span>
                    Limit: {maxMessages} {maxMessages === 1 ? 'message' : 'messages'} ({getFrequencyLabel(frequency)})
                  </span>
                </div>

                {buyMoreUrl && (
                  <div className="mt-5">
                    <a
                      href={buyMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-pink-500/25 active:scale-95 cursor-pointer"
                    >
                      <ShoppingBag size={15} />
                      <span>{buyMoreButtonText}</span>
                      <ExternalLink size={14} className="opacity-70" />
                    </a>
                  </div>
                )}
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (Only if enabled in Admin and not at limit) */}
          {enableQuickPrompts && messages.length <= 2 && !loading && !isLimitReached && (
            <div className="px-4 py-3 border-t border-white/5 bg-zinc-900/50 max-w-4xl mx-auto w-full flex flex-wrap gap-2">
              <span className="text-xs text-gray-400 w-full mb-1 flex items-center gap-1.5 font-medium">
                <GraduationCap size={15} className="text-pink-400" /> Sugestões para perguntar para {expertName}:
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

