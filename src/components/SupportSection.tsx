import React, { memo } from 'react';
import { MessageSquare, Mail, Info } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

interface SupportSectionProps {
  page: 'home' | 'community' | 'profile' | 'course' | 'lesson' | 'preview';
  settings: any;
  t: any;
}

const SupportSection = memo(({ page, settings, t }: SupportSectionProps) => {
  const getEnabledStatus = () => {
    if (page === 'lesson') {
      return {
        whatsapp: settings.custom_texts?.['config.support_whatsapp_lesson_enabled'] === 'true',
        email: settings.custom_texts?.['config.support_email_lesson_enabled'] === 'true'
      };
    }
    if (page === 'preview') {
      return {
        whatsapp: settings.custom_texts?.['config.support_whatsapp_preview_enabled'] !== 'false',
        email: settings.custom_texts?.['config.support_email_preview_enabled'] !== 'false'
      };
    }
    return {
      whatsapp: settings[`support_whatsapp_${page}_enabled`],
      email: settings[`support_email_${page}_enabled`]
    };
  };

  const { whatsapp: whatsappEnabled, email: emailEnabled } = getEnabledStatus();

  if (!whatsappEnabled && !emailEnabled) return null;

  return (
    <div className={`px-6 md:px-12 ${page === 'profile' ? 'pt-4' : 'pt-16'} pb-24 max-w-4xl mx-auto w-full`}>
      <div className="relative group">
        {/* Subtle animated glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-white/10 to-blue-500/20 rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
        
        <div className="relative bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 md:p-12 flex flex-col items-center text-center gap-3 md:gap-8 overflow-hidden">
          {/* Abstract geometric decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -ml-32 -mb-32" />

          <div className="relative space-y-2 md:space-y-3 max-w-2xl px-4">
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter italic uppercase leading-none">
              {settings.custom_texts?.['auth.support_box'] || 'Precisa de Suporte?'}
            </h3>
            <p className="text-zinc-400 text-sm md:text-base font-medium leading-relaxed">
              {settings.custom_texts?.['auth.support_description'] || t('auth.support_description') || 'Nossa equipe está pronta para te ajudar com qualquer dúvida ou problema técnico.'}
            </p>
          </div>

          <div className="relative flex flex-col items-center gap-3 md:gap-4 w-full sm:max-w-xs px-4">
            {whatsappEnabled && settings.support_whatsapp && (
              <a 
                href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 md:px-8 md:py-4 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-green-500/20 shadow-2xl shadow-green-500/10 active:scale-[0.97] group/btn"
              >
                <WhatsAppIcon size={18} className="group-hover/btn:scale-110 transition-transform duration-300" /> 
                {settings.custom_texts?.['auth.whatsapp_label'] || 'WHATSAPP'}
              </a>
            )}
            {emailEnabled && settings.support_email && (
              <a 
                href={`mailto:${settings.support_email}`}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 md:px-8 md:py-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/20 shadow-2xl shadow-blue-500/10 active:scale-[0.97] group/btn"
              >
                <Mail className="group-hover/btn:scale-110 transition-transform duration-300" size={18} /> 
                {settings.custom_texts?.['auth.email_label'] || 'EMAIL'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SupportSection;
