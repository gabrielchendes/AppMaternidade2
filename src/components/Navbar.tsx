import { memo } from 'react';
import { LogOut, User as UserIcon, Bell, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import NotificationBell from './NotificationBell';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';

interface NavbarProps {
  user: User;
  activeTab: 'home' | 'profile' | 'community' | 'admin';
  onTabChange: (tab: 'home' | 'profile' | 'community' | 'admin') => void;
}

const Navbar = memo(({ user, activeTab, onTabChange }: NavbarProps) => {
  const { settings } = useSettings();
  const { t } = useI18n();
  const isAdmin = user.email === settings?.admin_email || user.email === 'gabrielchendes@gmail.com';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(t('auth.logout_error') || 'Erro ao sair');
    else toast.success(t('auth.logout_success') || 'Até logo!');
  };

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent px-6 py-4 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-8">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => onTabChange('home')}
            className={`text-sm font-bold tracking-widest uppercase transition-colors ${
              activeTab === 'home' ? 'text-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            {settings?.custom_texts?.['nav.home'] || 'Início'}
          </button>
          <button
            onClick={() => onTabChange('community')}
            className={`text-sm font-bold tracking-widest uppercase transition-colors ${
              activeTab === 'community' ? 'text-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            {settings?.custom_texts?.['nav.community'] || 'Comunidade'}
          </button>
          <button
            onClick={() => onTabChange('profile')}
            className={`text-sm font-bold tracking-widest uppercase transition-colors ${
              activeTab === 'profile' ? 'text-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            {settings?.custom_texts?.['nav.profile'] || 'Perfil'}
          </button>
          {isAdmin && (
            <button
              onClick={() => onTabChange('admin')}
              className={`text-sm font-bold tracking-widest uppercase transition-colors flex items-center gap-2 ${
                activeTab === 'admin' ? 'text-primary' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shield size={16} /> {settings?.custom_texts?.['nav.admin'] || 'Admin'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell user={user} />
        
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-primary/30">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={12} className="text-primary" />
            )}
          </div>
          <span className="text-[10px] sm:text-xs font-bold tracking-tight">
            {user.user_metadata?.full_name || user.email?.split('@')[0]}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full border border-white/5 transition-all text-[10px] font-bold uppercase tracking-wider active:scale-95"
          title={t('global.logout') || "Sair"}
        >
          <LogOut size={14} />
          <span>{t('global.logout') || "Sair"}</span>
        </button>
      </div>
    </nav>
  );
});

export default Navbar;
