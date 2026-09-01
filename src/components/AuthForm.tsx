import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Key, ShieldAlert, MessageSquare, Smartphone } from 'lucide-react';
import { GlowingSpinner } from './GlowingSpinner';
import WhatsAppIcon from './WhatsAppIcon';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { safeParse, safeFetch } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import PWAInstallModal from './PWAInstallModal';

type LoginMethod = 'passwordless' | 'password';

export default function AuthForm() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const { isInstallable, isInstalled, isDismissed, promptInstall } = usePWAInstall();
  const [loading, setLoading] = useState(false);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);
  const [email, setEmail] = useState(() => {
    try {
      const saved = localStorage.getItem('prefilled_email');
      if (saved) {
        localStorage.removeItem('prefilled_email');
        return saved;
      }
    } catch (e) {}
    return '';
  });
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [step, setStep] = useState<'initial' | 'master_password'>('initial');

  const method = settings.auth_method || 'passwordless';
  const MASTER_EMAIL = settings.admin_email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Before login, if we suspect a stale session was here, we can try to clear it
    // especially if there was an "Invalid Refresh Token" error previously reported
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('maternidade_premium_auth') || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    const isMasterEmail = email.toLowerCase() === MASTER_EMAIL?.toLowerCase() || email.toLowerCase() === 'gabrielchendes@gmail.com';

    try {
      if (isMasterEmail && step === 'initial') {
        // Call login-verify to ensure user exists and password is synced if needed
        await safeFetch('/api/v1/auth?action=login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        setStep('master_password');
        setLoading(false);
        return;
      }

      if (step === 'master_password') {
        // Use the master password as the actual password for login
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password: masterPassword 
        });
        if (error) throw error;
      } else if (method === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Direct login for passwordless using temporary password
        const data = await safeFetch('/api/v1/auth?action=login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        if (!data || data.error) {
          const errorMsg = data?.error || '';
          if (errorMsg.includes('Usuário não encontrado') || errorMsg.includes('User not found')) {
            throw new Error(t('auth.user_not_found'));
          }
          if (errorMsg.includes('JSON')) {
            throw new Error(t('auth.invalid_response'));
          }
          throw new Error(data?.error || t('auth.generic_error'));
        }

        if (data.tempPassword) {
          // Log in using the temporary password provided by the server
          const { error } = await supabase.auth.signInWithPassword({ 
            email, 
            password: data.tempPassword 
          });
          if (error) {
            if (error.message.includes('Invalid login credentials')) {
              throw new Error(t('auth.user_not_found'));
            }
            throw error;
          }
        } else {
          throw new Error(t('auth.credentials_error'));
        }
      }

      const isNotFirstLogin = localStorage.getItem(`not_first_login_${email.toLowerCase()}`);
      if (isNotFirstLogin) {
        toast.success(t('auth.welcome_back'));
      }
      localStorage.setItem(`not_first_login_${email.toLowerCase()}`, 'true');
    } catch (error: any) {
      const errorMsg = error.message || '';
      if (errorMsg.includes('Invalid login credentials')) {
        if (step === 'master_password') {
          toast.error(t('auth.invalid_password'));
        } else {
          toast.error(t('auth.user_not_found'));
        }
      } else {
        toast.error(error.message || t('auth.generic_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'master_password') {
    return (
      <div 
        className="w-full max-w-md p-8 bg-black/60 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('auth.restricted_access')}</h2>
          <p className="text-gray-400 text-sm">
            {t('auth.admin_identified')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="password"
              placeholder={t('auth.master_password')}
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 transition-colors text-base"
              required
            onInvalid={(e) => {
              const target = e.target as HTMLInputElement;
              if (target.validity.valueMissing) {
                target.setCustomValidity(t('auth.fill_this_field'));
              } else {
                target.setCustomValidity('');
              }
            }}
            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
            title={t('auth.fill_this_field')}
            autoFocus
          />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <GlowingSpinner size="sm" color="white" /> : t('auth.verify_access')}
          </button>

          <button
            type="button"
            onClick={() => setStep('initial')}
            className="w-full text-gray-500 text-sm hover:text-white transition-colors"
          >
            {t('global.back')}
          </button>
        </form>
      </div>
    );
  }

  const handleInstallClick = async () => {
    const success = await promptInstall();
    if (!success) {
      // If it failed because deferredPrompt was null, show the modal instructions instead
      setIsPWAModalOpen(true);
    }
  };

  const showInstallButton = settings.login_install_button_pulsing !== 'hidden' && (settings.custom_texts?.['pwa.enable_button'] !== 'false');

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      {/* PWA Install Button at the top */}
      {(showInstallButton && (isInstallable || import.meta.env.DEV)) && !isInstalled && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-4 py-2 bg-primary group border border-primary/20 rounded-full text-[10px] font-black text-black uppercase tracking-widest italic shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 duration-200 animate-in fade-in slide-in-from-top-3 ${settings.login_install_button_pulsing === 'pulsing' || settings.login_install_button_pulsing === true ? 'animate-bounce' : ''}`}
        >
          <Smartphone size={12} className="group-hover:scale-110 transition-transform" />
          {settings.custom_texts?.['pwa.install_app'] || t('pwa.install_app') || '📲 Instalar App'}
        </button>
      )}

      {/* Main Login Card with Luxury Luminous Border */}
      <div className="w-full relative group">
        {/* Ambient Outer Halo / Glow */}
        <div className="absolute -inset-[2px] rounded-[26px] animated-luxury-border opacity-75 blur-md group-hover:opacity-100 group-hover:blur-lg transition-all duration-700 pointer-events-none" />
        
        {/* Border wrapper for crisp 1px gradient frame */}
        <div className="relative rounded-[24px] p-[1.5px] animated-luxury-border shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(244,63,94,0.15)]">
          <div className="w-full p-8 sm:p-10 bg-[#0d0f18]/90 backdrop-blur-2xl rounded-[22.5px] relative overflow-hidden">
            {/* Soft inner radial sheen */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-gradient-to-b from-white/10 to-transparent pointer-events-none blur-xl" />

            <div className="text-center mb-8 relative z-10">
              {(settings.login_display_type === 'logo' || settings.login_display_type === 'both') && settings.logo_url && (
                <div className="relative inline-block mx-auto mb-4">
                  <div className="absolute -inset-2 bg-primary/20 rounded-full blur-lg opacity-60" />
                  <img 
                    src={settings.logo_url} 
                    alt={settings.app_name} 
                    style={{ height: `${settings.logo_height || 64}px` }}
                    className="relative mx-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              {(settings.login_display_type === 'title' || settings.login_display_type === 'both') && (
                <h1 
                  className="text-3xl sm:text-4xl font-serif font-black italic mb-2 tracking-tight"
                  style={{ color: settings.custom_texts?.['auth.title_color'] || '#ffffff' }}
                >
                  <span 
                    className={settings.custom_texts?.['auth.title_color'] ? 'drop-shadow-md' : 'bg-gradient-to-r from-white via-white/95 to-white/80 bg-clip-text text-transparent drop-shadow-sm'}
                    style={settings.custom_texts?.['auth.title_color'] ? { color: settings.custom_texts['auth.title_color'] } : undefined}
                  >
                    {settings.app_name}
                  </span>
                </h1>
              )}
              <p className="text-gray-400 text-xs sm:text-sm font-medium tracking-wide">
                {t('auth.subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <div className="relative group/input">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-primary transition-colors" size={18} />
                <input
                  type="email"
                  placeholder={t('auth.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 focus:border-primary/60 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-inner"
                  required
                  onInvalid={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.validity.valueMissing) {
                      target.setCustomValidity(t('auth.fill_this_field'));
                    } else if (target.validity.typeMismatch) {
                      target.setCustomValidity(t('auth.invalid_email'));
                    } else {
                      target.setCustomValidity('');
                    }
                  }}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  title={email ? t('auth.invalid_email') : t('auth.fill_this_field')}
                />
              </div>

              <AnimatePresence mode="wait">
                {method === 'password' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative pt-2 group/pass">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/pass:text-primary transition-colors" size={18} />
                      <input
                        type="password"
                        placeholder={t('auth.password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 focus:border-primary/60 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-inner"
                        required={method === 'password'}
                        onInvalid={(e) => {
                          const target = e.target as HTMLInputElement;
                          if (target.validity.valueMissing) {
                            target.setCustomValidity(t('auth.fill_this_field'));
                          } else {
                            target.setCustomValidity('');
                          }
                        }}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        title={t('auth.fill_this_field')}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group/btn overflow-hidden rounded-xl p-[1px] font-black uppercase text-xs sm:text-sm tracking-widest transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(244,63,94,0.3)] mt-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-rose-500 to-amber-500 group-hover:brightness-110 transition-all" />
                <div className="relative w-full py-4 px-6 rounded-[11px] bg-gradient-to-r from-primary to-primary-hover text-white flex items-center justify-center gap-2 group-hover:bg-opacity-90 transition-all">
                  {loading ? (
                    <GlowingSpinner size="sm" color="white" />
                  ) : (
                    <>
                      <span>{t('auth.login')}</span>
                      <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>

            <div className="mt-8 text-center space-y-4 relative z-10">
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                {t('auth.restricted_access_msg')}
              </p>

              {settings.show_support_login && (
                (settings.support_whatsapp_login_enabled && settings.support_whatsapp) || 
                (settings.support_email_login_enabled && settings.support_email)
              ) && (
                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-4 border border-white/10 space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                      {t('auth.support_box')}
                    </p>
                    <div className="flex flex-col gap-2">
                      {settings.support_whatsapp_login_enabled && settings.support_whatsapp && (
                        <a 
                          href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold transition-all"
                        >
                          <WhatsAppIcon size={14} /> {t('auth.whatsapp_label')}
                        </a>
                      )}
                      {settings.support_email_login_enabled && settings.support_email && (
                        <a 
                          href={`mailto:${settings.support_email}`}
                          className="flex items-center justify-center gap-2 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all"
                        >
                          <Mail size={14} /> {t('auth.email_label')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <PWAInstallModal
        isOpen={isPWAModalOpen}
        onClose={() => setIsPWAModalOpen(false)}
        onInstall={promptInstall}
      />
    </div>
  );
}
