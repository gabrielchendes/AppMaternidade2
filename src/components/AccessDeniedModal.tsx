import React from 'react';
import { Lock, Sparkles, RefreshCw, LogOut, ExternalLink, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface AccessDeniedModalProps {
  userEmail: string;
}

export default function AccessDeniedModal({ userEmail }: AccessDeniedModalProps) {
  const { settings } = useSettings();

  const checkoutUrl = 
    settings?.custom_texts?.['hotmart.main_checkout_url'] || 
    settings?.custom_texts?.['main_checkout_url'] || 
    'https://hotmart.com';

  const title = settings?.custom_texts?.['access_denied_title'] || 'Acesso Principal Inativo';
  const message = settings?.custom_texts?.['access_denied_message'] || 'Sua assinatura ou compra principal da plataforma foi cancelada, reembolsada ou expirou na Hotmart.';
  const ctaText = settings?.custom_texts?.['access_denied_cta'] || 'Renovar Assinatura no Hotmart';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      toast.error('Erro ao encerrar sessão');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-500/20 blur-[90px] rounded-full pointer-events-none" />

        <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center justify-center mx-auto text-rose-400 shadow-inner">
          <ShieldAlert size={40} />
        </div>

        <div className="space-y-2">
          <span className="px-3.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
            Acesso Temporariamente Pausado
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-md mx-auto">
            {message}
          </p>
        </div>

        {/* Benefits preservation note */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4 text-left space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Sparkles size={16} />
            <span>Sua conta e histórico foram salvos com segurança!</span>
          </div>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            Assim que você renovar sua assinatura na Hotmart com o e-mail <strong>{userEmail}</strong>, todo o seu acesso, histórico de aulas e certificados serão reativados instantaneamente.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 active:scale-98"
          >
            <span>{ctaText}</span>
            <ExternalLink size={16} />
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            <span>Sair da Conta ({userEmail})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
