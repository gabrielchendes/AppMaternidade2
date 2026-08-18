import { memo } from 'react';
import { Home, User, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { motion } from 'motion/react';
import { AskVictoriaIcon } from './AskVictoriaIcon';
import { CommunityIcon } from './CommunityIcon';

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
  const tabName = settings?.custom_texts?.['ai_expert.tab_name']?.trim() || 'Ask Victoria';

  const tabs = [
    { id: 'home', icon: Home, label: settings?.custom_texts?.['nav.home'] || 'Início' },
    { id: 'community', icon: CommunityIcon, label: settings?.custom_texts?.['nav.community'] || 'Comunidade' },
    ...(isAiEnabled ? [{ id: 'ai', icon: null, label: tabName, isAi: true }] : []),
    { id: 'profile', icon: User, label: settings?.custom_texts?.['nav.profile'] || 'Perfil' },
    ...(isAdmin ? [{ id: 'admin', icon: Shield, label: settings?.custom_texts?.['nav.admin'] || 'Admin' }] : []),
  ];

  return (
    <div className="md:hidden fixed bottom-2 left-3 right-3 z-50 safe-area-pb">
      <div className="rounded-3xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.85)] bg-[#12141f]/90 backdrop-blur-2xl">
        <nav className="flex items-center justify-around w-full relative h-[66px] px-2 py-1">
          {/* Subtle top ambient gradient line */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          
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
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1 group active:scale-95 transition-transform duration-150"
              >
                {/* Container that holds both icon and label inside the active background pill */}
                <div className="relative flex flex-col items-center justify-center py-1.5 px-2 w-full max-w-[84px] rounded-2xl transition-all">
                  {/* Sliding active tab indicator enclosing BOTH icon and text label */}
                  {isActive && (
                    <motion.div 
                      layoutId="slidingActiveTabIndicator"
                      className={cn(
                        "absolute inset-0 rounded-2xl -z-10 transition-colors duration-200",
                        tab.isAi 
                          ? "bg-gradient-to-b from-pink-500/25 via-rose-500/20 to-pink-500/15 border border-pink-400/35 shadow-[0_0_20px_rgba(244,114,182,0.3)]" 
                          : "bg-gradient-to-b from-rose-500/25 via-rose-600/20 to-rose-700/15 border border-rose-500/35 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                      )}
                      transition={{ 
                        type: "spring", 
                        stiffness: 420, 
                        damping: 32 
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div className="relative flex items-center justify-center h-6 w-6 mb-0.5">
                    {tab.isAi ? (
                      <motion.div
                        animate={{ scale: isActive ? 1.12 : 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <AskVictoriaIcon
                          size={28}
                          isActive={isActive}
                          className={cn(
                            "transition-colors duration-200 relative z-10",
                            isActive ? "text-pink-200 drop-shadow-[0_0_10px_rgba(244,114,182,0.8)]" : "text-zinc-400 group-hover:text-zinc-200"
                          )}
                        />
                      </motion.div>
                    ) : Icon ? (
                      <motion.div
                        animate={{ scale: isActive ? 1.08 : 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} className={cn(
                          "transition-colors duration-200 relative z-10",
                          isActive ? "text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.7)]" : "text-zinc-400 group-hover:text-zinc-200"
                        )} />
                      </motion.div>
                    ) : null}
                  </div>

                  {/* Text Label inside the active highlight */}
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight transition-colors duration-200 leading-none text-center whitespace-nowrap",
                    isActive 
                      ? (tab.isAi ? "text-pink-200 font-bold" : "text-white font-bold") 
                      : "text-zinc-400 font-medium"
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
