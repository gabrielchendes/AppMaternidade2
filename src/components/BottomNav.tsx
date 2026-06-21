import { memo } from 'react';
import { Home, User, MessageSquare, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: 'home' | 'profile' | 'community' | 'admin';
  onTabChange: (tab: 'home' | 'profile' | 'community' | 'admin') => void;
  userEmail?: string;
}

const BottomNav = memo(({ activeTab, onTabChange, userEmail }: BottomNavProps) => {
  const { settings } = useSettings();
  const isAdmin = userEmail === settings?.admin_email;

  const tabs = [
    { id: 'home', icon: Home, label: settings?.custom_texts?.['nav.home'] || 'Início' },
    { id: 'community', icon: MessageSquare, label: settings?.custom_texts?.['nav.community'] || 'Comunidade' },
    { id: 'profile', icon: User, label: settings?.custom_texts?.['nav.profile'] || 'Perfil' },
    ...(isAdmin ? [{ id: 'admin', icon: Shield, label: settings?.custom_texts?.['nav.admin'] || 'Admin' }] : []),
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t-0 shadow-[0_-12px_40px_rgba(0,0,0,0.8)] safe-area-pb">
      <nav className="flex items-center justify-around w-full relative h-16 pt-1">
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
        
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button 
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className="relative flex flex-col items-center justify-center py-1 rounded-2xl flex-1 transition-all group active:scale-90"
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white/5 rounded-2xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <div className="relative flex flex-col items-center gap-0.5">
                <div className={cn(
                  "relative p-1 rounded-xl transition-all duration-300",
                  isActive ? "text-primary scale-110" : "text-gray-500 group-hover:text-gray-300"
                )}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                  {isActive && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 bg-primary/20 blur-md rounded-full -z-10"
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-[0.1em] transition-all duration-300",
                  isActive ? "text-white opacity-100" : "text-gray-500 opacity-60"
                )}>
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default BottomNav;
