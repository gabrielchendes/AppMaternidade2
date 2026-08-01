import React, { memo, useMemo } from 'react';
import { Lock, Play, Star, CheckCircle2, Rocket } from 'lucide-react';
import { Course } from '../types/lms';
import { motion } from 'motion/react';
import { useI18n } from '../contexts/I18nContext';
import { cn } from '../lib/utils';

interface ProductCardProps {
  product: Course;
  isUnlocked: boolean;
  progress?: number;
  stats?: { lessons: number, materials: number };
  settings?: any;
  onOpen: (product: Course) => void;
}

const ProductCard = memo(({ product, isUnlocked, progress = 0, stats, settings, onOpen }: ProductCardProps) => {
  const { t } = useI18n();

  // State calculations
  const isNotStarted = progress === 0;
  const isInProgress = progress > 0 && progress < 100;
  const isCompleted = progress === 100;

  // Visual configuration based on state
  const stateConfig = useMemo(() => {
    if (!isUnlocked) return {
      color: 'indigo',
      badge: t('badge.locked') || 'MÉTODO PREMIUM',
      cta: t('cta.unlock') || 'ADQUIRIR AGORA',
      bgGlow: 'group-hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]',
      progressBar: 'bg-indigo-500/30'
    };
    if (isCompleted) return {
      color: 'emerald',
      badge: t('badge.completed') || 'CONCLUÍDO',
      cta: t('cta.completed') || 'ASSISTIR NOVAMENTE',
      bgGlow: 'group-hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]',
      progressBar: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
    };
    if (isInProgress) return {
      color: 'blue',
      badge: t('badge.in_progress') || 'CONTINUAR',
      cta: t('cta.in_progress') || 'RETOMAR AULA',
      bgGlow: 'group-hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]',
      progressBar: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]'
    };
    return { // Not started
      color: 'amber',
      badge: t('badge.new') || 'COMEÇAR',
      cta: t('cta.new') || 'COMEÇAR AGORA',
      bgGlow: 'group-hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]',
      progressBar: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
    };
  }, [progress, isUnlocked, t]);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex-shrink-0 w-[140px] sm:w-[190px] cursor-pointer group rounded-2xl overflow-hidden shadow-2xl bg-zinc-950 transition-all duration-500 snap-start scroll-ml-6 md:scroll-ml-16 flex flex-col p-[1.5px] hover:p-[4px]",
        stateConfig.bgGlow
      )}
      onClick={() => onOpen(product)}
    >
      {/* AI Border Effect - Static & Filled with Pulse on Hover */}
      <div className="absolute inset-0 z-0 opacity-100 overflow-hidden">
        <motion.div
          className="absolute inset-0 z-0 transition-opacity duration-500 group-hover:opacity-100 opacity-80"
          animate={{
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: stateConfig.color === 'emerald' ? '#10b981' :
                        stateConfig.color === 'blue' ? '#3b82f6' :
                        stateConfig.color === 'amber' ? '#f59e0b' : '#a855f7'
          }}
        />
        {/* Particle/Glow effect for AI feel */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.4)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col flex-grow bg-zinc-950 rounded-[calc(1rem-1.5px)] group-hover:rounded-[calc(1rem-4px)] transition-all duration-500 overflow-hidden">
        {/* AURORA Status Icon (Top Left) */}
        {isUnlocked && (
          <div className={cn(
            "absolute top-2 left-2 z-40 p-1.5 sm:p-2 rounded-lg border backdrop-blur-md shadow-lg transition-all duration-500 opacity-60",
            stateConfig.color === 'emerald' ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" :
            stateConfig.color === 'blue' ? "bg-blue-500/20 text-blue-500 border-blue-500/30" :
            stateConfig.color === 'amber' ? "bg-amber-500/20 text-amber-500 border-amber-500/30" :
            "bg-white/20 text-white border-white/30"
          )}>
            {isCompleted ? <CheckCircle2 size={10} className="sm:size-[12px]" /> : 
             isInProgress ? <Rocket size={10} className="sm:size-[12px]" /> : 
             <Play size={10} className="sm:size-[12px]" />}
          </div>
        )}

        {/* Aurora Glow Effect Layer */}
        <div className={cn(
          "absolute -top-10 -left-10 w-40 h-40 blur-[60px] rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-1000 pointer-events-none z-0",
          isUnlocked ? "bg-emerald-500" : "bg-purple-600"
        )} />

        {/* Premium Shine Sweep (Visible on hover) */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          <motion.div 
            initial={{ x: '-100%', skewX: -20 }}
            whileHover={{ x: '200%' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        </div>

        {/* Thumbnail Area */}
        <div className="relative aspect-[4/5] overflow-hidden w-full z-10">
          <img
            src={(product.cover_url && product.cover_url.trim()) ? product.cover_url.trim() : `https://picsum.photos/seed/${product.id}/400/500`}
            alt={product.title}
            loading="lazy"
            className={cn(
              "w-full h-full object-cover transition-transform duration-1000",
              !isUnlocked && "opacity-60 grayscale-[0.5] blur-[1px]"
            )}
            referrerPolicy="no-referrer"
          />
          
          {/* Premium Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
          
          {/* Elite Locked Interface */}
          {!isUnlocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center z-30">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center text-white/80 shadow-[0_15px_35px_rgba(0,0,0,0.5)] mb-3 group-hover:border-purple-500/50 group-hover:text-purple-400 transition-all duration-700"
              >
                <Lock size={20} strokeWidth={2.5} className="drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
              </motion.div>
              <p className="text-[7px] sm:text-[8px] font-black text-white/50 uppercase tracking-[0.25em] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform translate-y-2 group-hover:translate-y-0">
                 {t('course.exclusive_content')}
              </p>
            </div>
          )}
        </div>

        {/* Info & CTA Section */}
        <div className="p-2.5 sm:p-4 flex flex-col gap-1.5 flex-grow relative bg-zinc-950 z-20">
          <h3 className="font-black text-[9px] sm:text-[11px] text-zinc-200 leading-tight uppercase tracking-[0.05em] group-hover:text-white transition-colors">
            {product.title}
          </h3>
          
          <div className="mt-auto pt-1">
            {/* Progress row above button */}
            {isUnlocked && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className="text-[6.5px] sm:text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none">
                    {progress}%
                  </span>
                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <CheckCircle2 size={8} className="text-emerald-500" />
                    </motion.div>
                  )}
                </div>
                <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={cn("h-full transition-all duration-1000 ease-out", stateConfig.progressBar)}
                  />
                </div>
              </div>
            )}
            
            <motion.div 
              className={cn(
                "w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl flex items-center justify-center gap-2 font-black text-[7.5px] sm:text-[9px] uppercase tracking-[0.2em] transition-all duration-700 relative overflow-hidden",
                stateConfig.color === 'emerald' ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-black group-hover:border-emerald-600" :
                stateConfig.color === 'blue' ? "bg-blue-500/10 border border-blue-500/30 text-blue-400 group-hover:bg-blue-600 group-hover:text-black group-hover:border-blue-600" :
                stateConfig.color === 'amber' ? "bg-amber-500/10 border border-amber-500/30 text-amber-500 group-hover:bg-amber-600 group-hover:text-black group-hover:border-amber-600" :
                "bg-purple-600/10 border border-purple-500/20 text-purple-400 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 shadow-[0_0_30px_rgba(147,51,234,0.1)]"
              )}
            >
              {/* Shimmer Button Effect */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10">{stateConfig.cta}</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tech Edge Glow - Bottom Border Glow */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-30",
        stateConfig.color === 'emerald' ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)]" :
        stateConfig.color === 'blue' ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,1)]" :
        stateConfig.color === 'amber' ? "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,1)]" :
        "bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)]"
      )} />
    </motion.div>
  );
});

export default ProductCard;
