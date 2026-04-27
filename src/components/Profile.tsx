import React, { useState, useRef } from 'react';
import { User, Lock, Mail, Save, Loader2, Camera, Bell, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { requestNotificationPermission } from '../lib/pushNotifications';

interface ProfileProps {
  user: SupabaseUser;
}

export default function Profile({ user }: ProfileProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
  const initialPhone = user.user_metadata?.phone || '';
  // Try to parse country code (assuming it's the first 2-3 digits after +)
  const [countryCode, setCountryCode] = useState(initialPhone.startsWith('+') ? initialPhone.substring(1, 4) : '');
  const [phoneBody, setPhoneBody] = useState(initialPhone.startsWith('+') ? initialPhone.substring(initialPhone.length > 4 ? 4 : 1) : initialPhone);
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushStatus, setPushStatus] = useState<{ supported: boolean, permission: string, tokenGenerated: boolean }>({
    supported: 'Notification' in window,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'not-supported',
    tokenGenerated: false
  });

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/';
    } catch (error: any) {
      toast.error('Erro ao sair da conta');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Get session first to ensure it's loaded
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error on mobile:', sessionError);
        throw new Error(`Sessão indisponível: ${sessionError.message}`);
      }

      // Step 2: Get user as the primary verification with refresh fallback
      let { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.warn('User missing from session, attempting refresh...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshedSession) {
          currentUser = refreshedSession.user;
        } else {
          console.error('Final user verification failure:', userError || refreshError);
          throw new Error('Auth session missing');
        }
      }

      // Update Auth metadata
      const fullPhone = `+${countryCode}${phoneBody}`;
      const { error: authError } = await supabase.auth.updateUser({
        data: { 
          full_name: fullName,
          phone: fullPhone,
          avatar_url: avatarUrl
        }
      });

      if (authError) throw authError;

      toast.success(t('profile.update_success') || 'Perfil atualizado com sucesso!');
    } catch (error: any) {
      console.error('Profile update error:', error);
      if (error.message?.includes('Auth session missing')) {
        toast.error('Sessão perdida. Reiniciando...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(error.message || 'Erro ao atualizar perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // High compression for profile photo (target ~80KB)
      const options = {
        maxSizeMB: 0.08,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setAvatarUrl(publicUrl);
      
      // Update metadata immediately
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase.auth.updateUser({
          data: { avatar_url: publicUrl }
        });
      }
      
      toast.success(t('profile.avatar_success') || 'Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      if (error.message?.includes('Auth session missing')) {
        toast.error('Sessão perdida. Reiniciando...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error('Erro ao enviar foto de perfil');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('profile.password_mismatch') || 'As senhas não coincidem');
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      toast.success(t('profile.password_success') || 'Senha atualizada com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-32">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t('profile.title') || 'Meu Perfil'}</h1>
        <p className="text-gray-400">{t('profile.subtitle') || 'Gerencie suas informações e segurança da conta.'}</p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center">
        <div 
          className="relative cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-40 h-40 rounded-full bg-zinc-800 border-4 border-primary/20 overflow-hidden flex items-center justify-center shadow-2xl transition-transform group-hover:scale-[1.02]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={64} className="text-gray-600" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={32} className="text-white" />
            </div>
          </div>
        </div>
        
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-full shadow-xl border-2 border-zinc-900 transition-all active:scale-95 mt-[-12px] relative z-10"
        >
          <Camera size={14} />
          <span className="text-[10px] font-black uppercase">{t('profile.change_photo') || 'Trocar foto'}</span>
        </button>
      </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleAvatarUpload} 
          accept="image/*" 
          className="hidden" 
        />
        
        <div className="text-center mt-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{fullName || 'Seu Nome'}</h2>
        </div>

      {/* Informações do Usuário */}
      <section className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
          <User size={18} />
          {t('profile.info_title') || 'Informações do Usuário'}
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('auth.email') || 'E-mail'} ({t('profile.access') || 'Acesso'})</label>
            <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/5 text-gray-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail size={18} className="opacity-50" />
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic">{t('profile.email_restricted') || 'O e-mail não pode ser alterado.'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.name_label') || 'Nome'}</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
              <User size={18} className="text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('profile.name_placeholder') || "Seu nome"}
                className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.phone_label') || 'Telefone (WhatsApp)'}</label>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 w-full">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 px-3 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors w-full overflow-hidden">
                  <span className="text-gray-400 font-bold text-sm flex-shrink-0">+</span>
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    placeholder="00"
                    maxLength={4}
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-base min-w-0"
                  />
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter block px-1 truncate">
                  {t('profile.phone_country_code') || 'Código País'}
                </span>
              </div>
              <div className="space-y-1 text-left min-w-0">
                <div className="flex items-center gap-3 px-3 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors w-full overflow-hidden">
                  <input
                    type="text"
                    value={phoneBody}
                    onChange={(e) => setPhoneBody(e.target.value.replace(/\D/g, ''))}
                    placeholder="(00) 00000-0000"
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-base min-w-0"
                  />
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter block px-1 truncate">
                  {t('profile.phone_number_label') || 'Número com DDD'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {t('profile.save_changes') || 'SALVAR ALTERAÇÕES'}
          </button>
        </form>
      </section>

      {/* Notificações Section */}
      <section className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
          <Bell size={18} />
          {t('profile.push_title') || 'Notificações Push'}
        </div>
        <p className="text-xs text-gray-500 font-medium">
          {t('profile.push_description') || 'Receba avisos importantes, novas aulas e atualizações da comunidade diretamente no seu navegador.'}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">{t('profile.status_support') || 'Suporte'}</div>
            <div className={`text-xs font-bold ${pushStatus.supported ? 'text-green-500' : 'text-red-500'}`}>
              {pushStatus.supported ? (t('profile.status_available') || 'DISPONÍVEL') : (t('profile.status_not_supported') || 'NÃO SUPORTADO')}
            </div>
          </div>
          <div className="bg-black/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">{t('profile.status_permission') || 'Permissão'}</div>
            <div className={`text-xs font-bold ${pushStatus.permission === 'granted' ? 'text-green-500' : pushStatus.permission === 'denied' ? 'text-red-500' : 'text-yellow-500'}`}>
              {pushStatus.permission.toUpperCase()}
            </div>
          </div>
        </div>
        
        <button
          onClick={async () => {
            const granted = await requestNotificationPermission(user.id);
            setPushStatus(prev => ({ 
              ...prev, 
              permission: Notification.permission,
              tokenGenerated: granted 
            }));
            
            if (granted) {
              toast.success(t('push.success') || 'Notificações ativadas com sucesso!');
            } else if (Notification.permission === 'denied') {
              toast.error(t('push.blocked') || 'Notificações bloqueadas no navegador. Redefina as permissões nas configurações do site.');
            } else {
              toast.error(t('push.error') || 'Não foi possível ativar. Verifique se você está em uma aba segura (HTTPS).');
            }
          }}
          className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
        >
          <Bell size={18} />
          {pushStatus.permission === 'granted' ? (t('profile.push_resync') || 'RE-SINCRONIZAR NOTIFICAÇÕES') : (t('push.allow') || 'ATIVAR NOTIFICAÇÕES')}
        </button>
      </section>

      {/* Segurança - Only show if auth method is password */}
      {settings.auth_method === 'password' && (
        <section className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
          <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
            <Lock size={18} />
            {t('profile.security_title') || 'Segurança'}
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.new_password_label') || 'Nova Senha'}</label>
              <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
                <Lock size={18} className="text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.confirm_password_label') || 'Confirmar Nova Senha'}</label>
              <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
                <Lock size={18} className="text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-base"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs border border-white/10"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
              {t('profile.update_password') || 'ATUALIZAR SENHA'}
            </button>
          </form>
        </section>
      )}

      {/* Sair da Conta */}
      <section className="pt-8 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all font-black uppercase tracking-widest text-xs active:scale-95"
        >
          <LogOut size={18} />
          {settings?.custom_texts?.['global.logout'] || t('global.logout') || "Sair da Conta"}
        </button>
      </section>

      <div className="text-center opacity-20 text-[10px] uppercase font-black tracking-[0.2em] pt-4 pb-8">
        {settings?.app_name || 'Maternidade Premium'} • {new Date().getFullYear()}
      </div>
    </div>
  );
}


