import React, { memo } from 'react';
import { Lock, Play, Star, CheckCircle2, Rocket, Book } from 'lucide-react';
import { Course } from '../types/lms';
import { motion } from 'motion/react';
import { useI18n } from '../contexts/I18nContext';

interface ProductCardProps {
  product: Course;
  isUnlocked: boolean;
  progress?: number;
  stats?: { lessons: number, materials: number };
  onOpen: (product: Course) => void;
}

const ProductCard = memo(({ product, isUnlocked, progress, stats, onOpen }: ProductCardProps) => {
  const { t } = useI18n();
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className="relative flex-shrink-0 w-[160px] sm:w-[220px] cursor-pointer group rounded-3xl overflow-hidden shadow-2xl bg-zinc-900 border border-white/5 snap-start"
      onClick={() => onOpen(product)}
    >
      {/* Cover Image - Netflix vertical style */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={product.cover_url || `https://picsum.photos/seed/${product.id}/400/600`} // Reduced size for cards
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        {/* Gradient Overlay - Optimized for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

        {/* Lock Overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center">
            <div className="bg-white/10 p-4 rounded-3xl border border-white/20 shadow-2xl">
              <Lock size={24} className="text-white" />
            </div>
          </div>
        )}

        {/* Info Overlay (Enhanced visibility) */}
        <div className="absolute inset-x-0 bottom-0 p-5 pt-20 bg-gradient-to-t from-black via-black/90 to-transparent transition-all duration-500">
          <div className="flex flex-col gap-4">
            <h3 className="font-black text-sm sm:text-xl text-white leading-[1.1] drop-shadow-2xl uppercase italic tracking-tighter line-clamp-2">
              {product.title}
            </h3>
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {progress === 100 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded-2xl backdrop-blur-md">
                    <CheckCircle2 size={14} className="text-green-400" />
                    <span className="text-[11px] font-black text-green-400 uppercase tracking-widest leading-none italic">
                      {t('course.completed')}
                    </span>
                  </div>
                ) : isUnlocked && progress !== undefined && progress > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-700/20 border border-blue-700/40 rounded-2xl backdrop-blur-md group-hover:bg-blue-700/30 transition-all">
                    <Play size={12} className="text-blue-500 fill-blue-500" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest leading-none italic">
                      {t('course.continue')}
                    </span>
                  </div>
                ) : isUnlocked ? (
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-2xl backdrop-blur-md group-hover:bg-yellow-500/30 transition-all">
                    <Rocket size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[11px] font-black text-yellow-400 uppercase tracking-widest leading-none italic">
                      {t('course.start')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md opacity-80 group-hover:opacity-100 transition-all">
                    <Star size={14} className="text-primary fill-primary/30" />
                    <span className="text-[11px] font-black text-white/60 uppercase tracking-widest leading-none">
                      Premium
                    </span>
                  </div>
                )}
              </div>
              {isUnlocked && progress !== undefined && (
                <div className={`${progress === 100 ? 'bg-green-500/20 border-green-500/30' : progress === 0 ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-blue-700/20 border-blue-700/30'} backdrop-blur-xl px-2.5 py-1 rounded-2xl border transition-all duration-500 shadow-xl flex items-center gap-1`}>
                  <span className={`text-[12px] font-black italic tracking-tighter ${progress === 100 ? 'text-green-400' : progress === 0 ? 'text-yellow-400' : 'text-blue-500'}`}>
                    {progress}%
                  </span>
                </div>
              )}
            </div>

            {/* Stats - Lessons & Materials */}
            {stats && (
              <div className="flex items-center gap-3 mt-1">
                {stats.lessons > 0 && (
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-widest">
                    <Play size={10} className="text-primary" />
                    {stats.lessons} {stats.lessons === 1 ? 'Aula' : 'Aulas'}
                  </div>
                )}
                {stats.materials > 0 && (
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-widest">
                    <Book size={10} className="text-secondary" />
                    {stats.materials} {stats.materials === 1 ? 'Mat.' : 'Mat.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* High-Visibility Progress Bar */}
        {isUnlocked && progress !== undefined && (
          <div className="absolute inset-x-0 bottom-0 h-2 bg-white/5 border-t border-white/5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full ${progress === 100 ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]' : progress === 0 ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.8)]' : 'bg-blue-700 shadow-[0_0_20px_rgba(29,78,216,0.8)]'} transition-all duration-1000`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default ProductCard;
