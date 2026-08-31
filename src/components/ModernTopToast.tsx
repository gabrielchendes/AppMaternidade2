import React from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles, X, ChevronUp, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'default';

export interface ModernTopToastProps {
  id: string | number;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  variant?: ToastVariant;
  icon?: React.ReactNode;
  badge?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface VariantConfig {
  badgeLabel: string;
  badgeText: string;
  badgeBg: string;
  iconBg: string;
  iconRing: string;
  iconGlow: string;
  iconNode: React.ReactNode;
  ambientGlow: string;
  topGleam: string;
}

const variantConfigs: Record<ToastVariant, VariantConfig> = {
  success: {
    badgeLabel: 'SUCESSO',
    badgeText: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
    iconBg: 'bg-gradient-to-br from-emerald-500/25 via-emerald-950/40 to-black',
    iconRing: 'ring-1 ring-emerald-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]',
    iconNode: <CheckCircle2 size={19} className="text-emerald-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.22),0_0_25px_rgba(16,185,129,0.15)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-emerald-400/0',
  },
  error: {
    badgeLabel: 'ATENÇÃO',
    badgeText: 'text-rose-300',
    badgeBg: 'bg-rose-500/15 border-rose-500/30',
    iconBg: 'bg-gradient-to-br from-rose-500/25 via-rose-950/40 to-black',
    iconRing: 'ring-1 ring-rose-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(244,63,94,0.35)]',
    iconNode: <AlertCircle size={19} className="text-rose-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(244,63,94,0.25),0_0_20px_rgba(245,158,11,0.15)]',
    topGleam: 'from-amber-400/0 via-rose-400/90 to-amber-400/0',
  },
  warning: {
    badgeLabel: 'AVISO',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    iconBg: 'bg-gradient-to-br from-amber-500/25 via-amber-950/40 to-black',
    iconRing: 'ring-1 ring-amber-400/50 border border-amber-300/50',
    iconGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    iconNode: <AlertTriangle size={19} className="text-amber-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.3)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-amber-400/0',
  },
  info: {
    badgeLabel: 'INFORMAÇÃO',
    badgeText: 'text-sky-300',
    badgeBg: 'bg-sky-500/15 border-sky-500/30',
    iconBg: 'bg-gradient-to-br from-sky-500/25 via-sky-950/40 to-black',
    iconRing: 'ring-1 ring-sky-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(56,189,248,0.35)]',
    iconNode: <Info size={19} className="text-sky-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(56,189,248,0.2),0_0_25px_rgba(245,158,11,0.18)]',
    topGleam: 'from-amber-400/0 via-amber-300/80 to-sky-400/0',
  },
  achievement: {
    badgeLabel: 'CONQUISTA',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-400/40',
    iconBg: 'bg-gradient-to-br from-amber-400/30 via-yellow-600/30 to-black',
    iconRing: 'ring-1 ring-amber-300/60 border border-yellow-200/60',
    iconGlow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]',
    iconNode: <Trophy size={19} className="text-amber-300 animate-pulse" />,
    ambientGlow: 'shadow-[0_18px_50px_-10px_rgba(251,191,36,0.4),0_0_30px_rgba(245,158,11,0.25)]',
    topGleam: 'from-yellow-400/0 via-amber-200 to-yellow-400/0',
  },
  default: {
    badgeLabel: 'NOTIFICAÇÃO',
    badgeText: 'text-amber-300',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    iconBg: 'bg-gradient-to-br from-amber-500/25 via-amber-950/30 to-black',
    iconRing: 'ring-1 ring-amber-400/40 border border-amber-400/40',
    iconGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    iconNode: <Sparkles size={19} className="text-amber-300" />,
    ambientGlow: 'shadow-[0_16px_45px_-10px_rgba(245,158,11,0.25)]',
    topGleam: 'from-amber-400/0 via-amber-300/90 to-amber-400/0',
  }
};

export const ModernTopToast: React.FC<ModernTopToastProps> = ({
  id,
  title,
  description,
  variant = 'default',
  icon,
  badge,
  action,
}) => {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-80, -20, 0], [0, 0.7, 1]);
  const scale = useTransform(y, [-80, 0], [0.9, 1]);

  const cfg = variantConfigs[variant] || variantConfigs.default;

  const handleDismiss = () => {
    toast.dismiss(id);
  };

  return (
    <motion.div
      style={{ y, opacity, scale }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.85, bottom: 0.08 }}
      onDragEnd={(_, info) => {
        // If dragged upwards by more than 12px or with upward velocity, dismiss smoothly
        if (info.offset.y < -12 || info.velocity.y < -120) {
          handleDismiss();
        }
      }}
      initial={{ opacity: 0, y: -30, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -40, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 380 }}
      className="group relative w-full max-w-[94vw] sm:max-w-md mx-auto select-none cursor-grab active:cursor-grabbing"
    >
      {/* Outer 24K Gold Radiant Chassis with Ambient Shimmer */}
      <div className={`relative rounded-[24px] p-[1.8px] bg-gradient-to-b from-amber-300 via-amber-500/60 to-amber-900/60 shadow-[0_18px_50px_-10px_rgba(245,158,11,0.32),0_0_28px_rgba(251,191,36,0.18)] hover:shadow-[0_20px_55px_-8px_rgba(245,158,11,0.45),0_0_35px_rgba(251,191,36,0.28)] transition-all duration-300 overflow-hidden ${cfg.ambientGlow}`}>
        
        {/* Dynamic Traveling Gold Shimmer Beam */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]">
          <div className="w-[120%] h-full bg-gradient-to-r from-transparent via-amber-200/35 to-transparent animate-gold-shimmer pointer-events-none" />
        </div>

        {/* Main Obsidian Glass Body */}
        <div className="relative rounded-[22px] bg-gradient-to-b from-[#141624]/98 via-[#0c0e16]/98 to-[#06070a]/98 backdrop-blur-3xl p-3.5 sm:p-4 text-white overflow-hidden ring-1 ring-inset ring-amber-400/20">
          
          {/* Top Specular Gold Horizon Beam */}
          <div className={`absolute top-0 inset-x-6 h-[1.5px] bg-gradient-to-r ${cfg.topGleam} opacity-95 shadow-[0_0_10px_rgba(251,191,36,0.8)]`} />

          {/* Luxury Ambient Radial Glow inside */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-52 h-24 bg-amber-500/12 rounded-full blur-2xl pointer-events-none" />

          {/* Header Row: Jewel-Cut Icon + Content + Close Action */}
          <div className="flex items-start gap-3.5 pt-0.5">
            {/* Jewel-Cut Icon Frame */}
            <div className={`relative p-2.5 rounded-2xl shrink-0 ${cfg.iconBg} ${cfg.iconRing} ${cfg.iconGlow} flex items-center justify-center shadow-lg shadow-black/40`}>
              {icon || cfg.iconNode}
              {/* Corner Specular Diamond Sparkle */}
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-gradient-to-br from-amber-100 to-amber-300 shadow-[0_0_8px_#fde047] ring-1 ring-white/60" />
            </div>

            {/* Content & Micro Badges */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${cfg.badgeBg} ${cfg.badgeText} flex items-center gap-1 shadow-sm`}>
                  <Sparkles size={9} className="text-amber-300 animate-pulse" />
                  {badge || cfg.badgeLabel}
                </span>
              </div>

              <div className="text-sm font-bold text-white tracking-tight leading-snug drop-shadow-sm">
                {title}
              </div>

              {description && (
                <div className="mt-1 text-xs text-zinc-300/90 leading-relaxed font-normal">
                  {description}
                </div>
              )}

              {action && (
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                      handleDismiss();
                    }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500/25 via-amber-400/35 to-amber-500/25 hover:from-amber-400/40 hover:to-amber-300/50 border border-amber-300/60 text-amber-100 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>

            {/* Direct Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="shrink-0 p-1.5 text-zinc-400 hover:text-amber-200 rounded-xl hover:bg-amber-400/15 border border-transparent hover:border-amber-400/30 transition-all cursor-pointer"
              title="Fechar notificação"
            >
              <X size={14} />
            </button>
          </div>

          {/* Ergonomic Luxury Bottom Pull-Tab with Animated Upward Arrow */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="mt-3 pt-1.5 border-t border-amber-400/15 flex items-center justify-between cursor-pointer group/handle select-none"
            title="Puxe para cima ou toque para fechar"
          >
            <div className="flex items-center gap-1.5">
              {/* Glowing Upward Arrow Capsule */}
              <div className="flex items-center justify-center w-6 h-5 rounded-lg bg-gradient-to-t from-amber-500/25 to-amber-300/30 border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.35)] group-hover/handle:bg-amber-400/40 group-hover/handle:border-amber-300 transition-all">
                <ChevronUp size={14} className="text-amber-200 animate-float-up stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold text-amber-300/80 group-hover/handle:text-amber-200 transition-colors tracking-wide flex items-center gap-1">
                Puxe para cima <span className="text-amber-400/50 text-[9px]">• Toque para fechar</span>
              </span>
            </div>

            <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-amber-400/50 group-hover/handle:text-amber-300/80 transition-colors font-semibold">
              <Sparkles size={10} className="text-amber-400/60" />
              <span>Privé</span>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

