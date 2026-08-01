import { memo } from 'react';
import { LogOut, User as UserIcon, Bell, Shield, Download, GraduationCap } from 'lucide-react';
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
  onOpenAi?: () => void;
  isAiOpen?: boolean;
  canInstall?: boolean;
  onInstall?: () => void;
  totalProgress?: number;
  onOpenProgress?: () => void;
}

const Navbar = memo(({ 
  user, 
  activeTab, 
  onTabChange, 
  onOpenAi,
  isAiOpen,
  canInstall, 
  onInstall,
  totalProgress = 0,
  onOpenProgress
}: NavbarProps) => {
  const { settings } = useSettings();
  const { t } = useI18n();
  const isAdmin = user.email === settings?.admin_email;
  
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
          {/* Left: Install App */}
          <div className="shrink-0 min-w-[40px] ml-2">
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
  
          {/* Center: Interactive User Chip with Progress */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <button
              onClick={onOpenProgress}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md active:scale-95 transition-all text-white shrink-0"
              title={t('gamification.view_progress_tooltip') || "Ver Progresso & Medalhas"}
            >
              <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-white/25 shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={14} className="text-primary" />
                )}
              </div>
              <span className="text-[10px] font-bold tracking-tight max-w-[85px] truncate">
                {displayName}
              </span>
              
              <div className="flex items-center justify-center w-8 h-8 relative shrink-0">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    className="stroke-white/10"
                    strokeWidth="2"
                    fill="#18181b"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    className="stroke-primary"
                    strokeWidth="2"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 13}
                    strokeDashoffset={2 * Math.PI * 13 * (1 - totalProgress / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[9px] font-black text-zinc-100 italic relative z-10 leading-none">
                  {totalProgress}%
                </span>
              </div>
            </button>
          </div>

        {/* Right Section: Bell */}
        <div className="shrink-0 mr-2">
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
            {onOpenAi && settings?.custom_texts?.['ai_expert.enabled'] !== 'false' && (
              <button
                onClick={onOpenAi}
                className={`text-sm font-bold tracking-widest uppercase transition-colors ${
                  isAiOpen ? 'text-primary' : 'text-gray-400 hover:text-white'
                }`}
              >
                {settings?.custom_texts?.['ai_expert.name'] ? `Ask ${settings.custom_texts['ai_expert.name']}` : 'Ask Victoria'}
              </button>
            )}
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

        {/* Right side content Desktop: Download -> Name -> Bell */}
        <div className="flex items-center gap-4 shrink-0">
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

          {/* User Chip clickable with Progress */}
          <button
            onClick={onOpenProgress}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md active:scale-95 transition-all text-white shrink-0"
            title={t('gamification.view_progress_tooltip') || "Ver Progresso & Medalhas"}
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-white/25 shrink-0">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={16} className="text-primary" />
              )}
            </div>
            <span className="text-xs font-bold tracking-tight">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </span>

            {/* Progress circle */}
            <div className="flex items-center justify-center w-9 h-9 relative shrink-0 ml-1">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-white/10"
                  strokeWidth="2"
                  fill="#18181b"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-primary"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={2 * Math.PI * 15 * (1 - totalProgress / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[10px] font-black text-zinc-100 italic relative z-10 leading-none">
                {totalProgress}%
              </span>
            </div>
          </button>
          
          {/* Bell */}
          <NotificationBell user={user} />
        </div>
      </div>
    </nav>
  );
});

export default Navbar;
