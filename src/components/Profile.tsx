import React, { useState, useRef } from 'react';
import { User, Lock, Mail, Save, Loader2, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';

interface ProfileProps {
  user: SupabaseUser;
}

export default function Profile({ user }: ProfileProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(user.user_metadata?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { 
          full_name: fullName,
          phone: phone,
          avatar_url: avatarUrl
        }
      });

      if (authError) throw authError;

      toast.success(t('profile.update_success') || 'Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar perfil');
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
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
      
      toast.success(t('profile.avatar_success') || 'Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao enviar foto de perfil');
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
                className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('profile.phone_label') || 'Telefone (WhatsApp)'}</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus-within:border-primary/50 transition-colors">
              <svg className="w-[18px] h-[18px] text-gray-400 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-sm"
              />
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
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-sm"
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
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-sm"
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

      <div className="pt-8 border-t border-white/5 text-center">
      </div>
    </div>
  );
}


