import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, Key, ShieldAlert, MessageSquare, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { safeParse, safeFetch } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type LoginMethod = 'passwordless' | 'password';

export default function AuthForm() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [step, setStep] = useState<'initial' | 'master_password'>('initial');

  const method = settings.auth_method || 'passwordless';
  const MASTER_EMAIL = settings.admin_email || 'gabrielchendes@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (email.toLowerCase() === MASTER_EMAIL && step === 'initial') {
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
        console.log('🔎 Chamando API Auth Direct');
        const data = await safeFetch('/api/auth/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        if (!data || data.error) {
          throw new Error(data?.error || 'Erro ao realizar login direto');
        }

        if (data.tempPassword) {
          // Log in using the temporary password provided by the server
          const { error } = await supabase.auth.signInWithPassword({ 
            email, 
            password: data.tempPassword 
          });
          if (error) throw error;
        } else {
          throw new Error('Falha ao gerar credenciais de acesso');
        }
      }

      toast.success(t('auth.welcome_back'));
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'master_password') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-black/60 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('auth.restricted_access')}</h2>
          <p className="text-gray-400 text-sm">
            Identificamos um acesso administrativo. Por favor, insira a senha mestre para continuar.
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
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 transition-colors"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verificar Acesso'}
          </button>

          <button
            type="button"
            onClick={() => setStep('initial')}
            className="w-full text-gray-500 text-sm hover:text-white transition-colors"
          >
            Voltar
          </button>
        </form>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
      <div className="text-center mb-8">
        {(settings.login_display_type === 'logo' || settings.login_display_type === 'both') && settings.logo_url && (
          <img 
            src={settings.logo_url} 
            alt={settings.app_name} 
            className="h-16 mx-auto mb-4 object-contain"
            referrerPolicy="no-referrer"
          />
        )}
        {(settings.login_display_type === 'title' || settings.login_display_type === 'both') && (
          <h1 className="text-3xl font-bold text-primary italic mb-2">
            {settings.app_name}
          </h1>
        )}
        <p className="text-gray-400 text-sm">
          {settings.app_description}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-primary transition-colors"
            required
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
              <div className="relative pt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  placeholder={t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-primary transition-colors"
                  required={method === 'password'}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              {t('auth.login')}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center space-y-4">
        <p className="text-xs text-gray-500">
          {t('auth.restricted_access_msg')}
        </p>

        {settings.show_support_login && (
          (settings.support_whatsapp_login_enabled && settings.support_whatsapp) || 
          (settings.support_email_login_enabled && settings.support_email)
        ) && (
          <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
                {t('auth.support_box')}
              </p>
              <div className="flex flex-col gap-2">
                {settings.support_whatsapp_login_enabled && settings.support_whatsapp && (
                  <a 
                    href={`https://wa.me/${settings.support_whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-xs font-bold transition-all"
                  >
                    <Phone size={14} /> {settings.custom_texts?.['auth.whatsapp_label'] || 'WhatsApp'}
                  </a>
                )}
                {settings.support_email_login_enabled && settings.support_email && (
                  <a 
                    href={`mailto:${settings.support_email}`}
                    className="flex items-center justify-center gap-2 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-all"
                  >
                    <Mail size={14} /> {settings.custom_texts?.['auth.email_label'] || 'E-mail'}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
