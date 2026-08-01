import { memo } from 'react';
import { Home, User, MessageSquare, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { motion } from 'motion/react';
import { AskVictoriaIcon } from './AskVictoriaIcon';

interface BottomNavProps {
  activeTab: 'home' | 'profile' | 'community' | 'admin';
  onTabChange: (tab: 'home' | 'profile' | 'community' | 'admin') => void;
  onOpenAi?: () => void;
  isAiOpen?: boolean;
  userEmail?: string;
}

const BottomNav = memo(({ activeTab, onTabChange, onOpenAi, isAiOpen, userEmail }: BottomNavProps) => {
  const { settings } = useSettings();
  const isAdmin = userEmail === settings?.admin_email;
  const isAiEnabled = settings?.custom_texts?.['ai_expert.enabled'] !== 'false';
  const expertName = settings?.custom_texts?.['ai_expert.name'] || 'Victoria';

  const tabs = [
    { id: 'home', icon: Home, label: settings?.custom_texts?.['nav.home'] || 'Início' },
    { id: 'community', icon: MessageSquare, label: settings?.custom_texts?.['nav.community'] || 'Comunidade' },
    ...(isAiEnabled ? [{ id: 'ai', icon: null, label: `Ask ${expertName}`, isAi: true }] : []),
    { id: 'profile', icon: User, label: settings?.custom_texts?.['nav.profile'] || 'Perfil' },
    ...(isAdmin ? [{ id: 'admin', icon: Shield, label: settings?.custom_texts?.['nav.admin'] || 'Admin' }] : []),
  ];

  return (
    <div className="md:hidden fixed bottom-1 left-0 right-0 z-50 px-2 safe-area-pb">
      <div className="glass rounded-3xl border border-white/[0.12] shadow-[0_-8px_32px_rgba(0,0,0,0.8)] bg-zinc-950/90 backdrop-blur-xl">
        <nav className="flex items-center justify-around w-full relative h-[68px] px-1 py-1">
          {/* Background ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none rounded-3xl" />
          
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.isAi ? !!isAiOpen : activeTab === tab.id;
            
            return (
              <button 
                key={tab.id}
                onClick={() => {
                  if (tab.isAi) {
                    onOpenAi?.();
                  } else {
                    onTabChange(tab.id as any);
                  }
                }}
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1 group transition-transform active:scale-95 duration-200"
              >
                {/* Container that holds both icon and label inside the active background pill */}
                <div className="relative flex flex-col items-center justify-center py-2 px-1.5 w-full max-w-[82px] rounded-2xl transition-all">
                  {/* Sliding active tab indicator enclosing BOTH icon and text label */}
                  {isActive && (
                    <motion.div 
                      layoutId="slidingActiveTabIndicator"
                      className={cn(
                        "absolute inset-0 rounded-2xl -z-10 transition-colors duration-200",
                        tab.isAi 
                          ? "bg-gradient-to-b from-pink-500/35 via-rose-500/25 to-pink-500/20 border border-pink-500/45 shadow-[0_0_16px_rgba(244,114,182,0.35)]" 
                          : "bg-gradient-to-b from-rose-600/35 via-rose-500/25 to-primary/20 border border-rose-500/45 shadow-[0_0_16px_rgba(244,63,94,0.35)]"
                      )}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 30 
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div className="relative flex items-center justify-center h-6 w-6 mb-1">
                    {tab.isAi ? (
                      <motion.div
                        animate={{ scale: isActive ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <AskVictoriaIcon
                          size={23}
                          isActive={isActive}
                          className={cn(
                            "transition-colors duration-200 relative z-10",
                            isActive ? "text-pink-200 drop-shadow-[0_0_8px_rgba(244,114,182,0.7)]" : "text-gray-400 group-hover:text-gray-200"
                          )}
                        />
                      </motion.div>
                    ) : Icon ? (
                      <motion.div
                        animate={{ scale: isActive ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <Icon size={20} strokeWidth={isActive ? 2.4 : 2} className={cn(
                          "transition-colors duration-200 relative z-10",
                          isActive ? "text-white drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" : "text-gray-400 group-hover:text-gray-200"
                        )} />
                      </motion.div>
                    ) : null}
                  </div>

                  {/* Text Label inside the active highlight */}
                  <span className={cn(
                    "text-[9.5px] font-black uppercase tracking-[0.04em] transition-colors duration-200 leading-none text-center whitespace-nowrap",
                    isActive 
                      ? (tab.isAi ? "text-pink-200 font-black drop-shadow-sm" : "text-white font-black drop-shadow-sm") 
                      : "text-gray-400 font-medium opacity-80"
                  )}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
});

export default BottomNav;
