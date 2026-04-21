import { memo } from 'react';
import { Home, User, MessageSquare, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';

interface BottomNavProps {
  activeTab: 'home' | 'profile' | 'community' | 'admin';
  onTabChange: (tab: 'home' | 'profile' | 'community' | 'admin') => void;
  userEmail?: string;
}

const BottomNav = memo(({ activeTab, onTabChange, userEmail }: BottomNavProps) => {
  const { settings } = useSettings();
  const isAdmin = userEmail === settings?.admin_email || userEmail === 'gabrielchendes@gmail.com';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-t border-white/10 px-6 py-3 flex items-center justify-between">
      <button 
        onClick={() => onTabChange('home')}
        className={cn(
          "flex flex-col items-center gap-1 transition-colors",
          activeTab === 'home' ? "text-primary" : "text-gray-400 hover:text-white"
        )}
      >
        <Home size={20} />
        <span className="text-[10px] font-medium">{settings?.custom_texts?.['nav.home'] || 'Início'}</span>
      </button>
      <button 
        onClick={() => onTabChange('community')}
        className={cn(
          "flex flex-col items-center gap-1 transition-colors",
          activeTab === 'community' ? "text-primary" : "text-gray-400 hover:text-white"
        )}
      >
        <MessageSquare size={20} />
        <span className="text-[10px] font-medium">{settings?.custom_texts?.['nav.community'] || 'Comunidade'}</span>
      </button>
      <button 
        onClick={() => onTabChange('profile')}
        className={cn(
          "flex flex-col items-center gap-1 transition-colors",
          activeTab === 'profile' ? "text-primary" : "text-gray-400 hover:text-white"
        )}
      >
        <User size={20} />
        <span className="text-[10px] font-medium">{settings?.custom_texts?.['nav.profile'] || 'Perfil'}</span>
      </button>
      {isAdmin && (
        <button 
          onClick={() => onTabChange('admin')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'admin' ? "text-primary" : "text-gray-400 hover:text-white"
          )}
        >
          <Shield size={20} />
          <span className="text-[10px] font-medium">{settings?.custom_texts?.['nav.admin'] || 'Admin'}</span>
        </button>
      )}
    </div>
  );
});

export default BottomNav;
