import { memo } from 'react';
import { LogOut, User as UserIcon, Bell, Shield, Download, RefreshCw } from 'lucide-react';
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
  canInstall?: boolean;
  onInstall?: () => void;
}

const Navbar = memo(({ user, activeTab, onTabChange, canInstall, onInstall }: NavbarProps) => {
  const { settings } = useSettings();
  const { t } = useI18n();
  const isAdmin = user.email === settings?.admin_email || user.email === 'gabrielchendes@gmail.com';
  
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(t('auth.logout_error') || 'Erro ao sair');
    else toast.success(t('auth.logout_success') || 'Até logo!');
  };

    const rawName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
    const displayName = rawName.length > 18 ? rawName.substring(0, 18) + '...' : rawName;

    return (
      <nav className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent px-4 sm:px-6 py-4 transition-all duration-300">
        {/* Mobile View */}
        <div className="flex md:hidden items-center justify-between w-full relative">
          {/* Left: Refresh */}
          <div className="shrink-0">
            <button 
              onClick={handleRefresh}
              className="p-2 bg-white/5 text-gray-400 rounded-full hover:bg-white/10 transition-all active:scale-90 border border-white/5"
              title="Recarregar"
            >
              <RefreshCw size={18} />
            </button>
          </div>
  
          {/* Middle-Left: Install App (centered between left and center) */}
          <div className="absolute left-[17%] -translate-x-1/2">
            {canInstall && onInstall && (
              <button 
                onClick={onInstall}
                className="p-2 bg-white/5 text-primary rounded-full hover:bg-white/10 transition-all active:scale-90 border border-white/5"
                title={settings?.custom_texts?.['pwa.install_app'] || t('pwa.install_app') || "Instalar App"}
              >
                <Download size={18} />
              </button>
            )}
          </div>
  
          {/* Center: User Chip */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
              <div className="w-5 h-5 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-primary/30 shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={10} className="text-primary" />
                )}
              </div>
              <span className="text-[10px] font-bold tracking-tight max-w-[110px] truncate">
                {displayName}
              </span>
            </div>
          </div>

        {/* Right Section: Bell */}
        <div className="shrink-0">
          <NotificationBell user={user} />
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-between w-full">
        <div className="flex items-center gap-8">
          {/* Desktop Navigation - Header Menu */}
          <div className="flex items-center gap-6">
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

        {/* Right side content Desktop: Refresh -> Download -> Name -> Bell */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            className="p-2 bg-white/5 text-gray-400 rounded-full hover:bg-white/10 transition-all active:scale-90 border border-white/5"
            title="Recarregar"
          >
            <RefreshCw size={14} />
          </button>

          {/* Install button */}
          {canInstall && onInstall && (
            <button 
              onClick={onInstall}
              className="p-2 bg-white/5 text-primary rounded-full hover:bg-white/10 transition-all active:scale-90 border border-white/5"
              title={settings?.custom_texts?.['pwa.install_app'] || t('pwa.install_app') || "Instalar App"}
            >
              <Download size={14} />
            </button>
          )}

          {/* User Chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
            <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-primary/30">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={12} className="text-primary" />
              )}
            </div>
            <span className="text-xs font-bold tracking-tight">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </span>
          </div>
          
          {/* Bell */}
          <NotificationBell user={user} />
        </div>
      </div>
    </nav>
  );
});

export default Navbar;
