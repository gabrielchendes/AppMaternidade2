import React, { memo } from 'react';
import { Lock, Play, Star, CheckCircle2, Rocket } from 'lucide-react';
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
      className="relative flex-shrink-0 w-[150px] sm:w-[220px] cursor-pointer group rounded-2xl overflow-hidden shadow-xl bg-zinc-900 border border-white/5 snap-start flex flex-col"
      onClick={() => onOpen(product)}
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] overflow-hidden w-full">
        <img
          src={product.cover_url || `https://picsum.photos/seed/${product.id}/400/600`}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        {/* Lock Overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/20 shadow-2xl">
              <Lock size={20} className="text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Info Content Section (Below the image) */}
      <div className="p-3 flex flex-col gap-2 flex-grow bg-zinc-900/50">
        <h3 className="font-bold text-[12px] sm:text-base text-zinc-100 leading-tight line-clamp-2 min-h-[2.4rem]">
          {product.title}
        </h3>
        
        <div className="mt-auto pt-1 space-y-2">
          {isUnlocked ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-1">
                {progress === 100 ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-green-400" />
                    <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter italic">
                      {t('course.completed')}
                    </span>
                  </div>
                ) : progress > 0 ? (
                  <div className="flex items-center gap-1">
                    <Play size={8} className="text-blue-500 fill-blue-500" />
                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter italic">
                      {t('course.continue')}
                    </span>
                  </div>
                ) : (
                   <div className="flex items-center gap-1">
                    <Rocket size={10} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[8px] font-black text-yellow-400 uppercase tracking-tighter italic">
                      {t('course.start')}
                    </span>
                  </div>
                )}

                <span className={`text-[9px] font-black italic tracking-tighter ${progress === 100 ? 'text-green-400' : progress === 0 ? 'text-yellow-400' : 'text-blue-500'}`}>
                  {progress}%
                </span>
              </div>

              {/* Progress Bar Container */}
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className={`h-full ${progress === 100 ? 'bg-green-500' : progress === 0 ? 'bg-yellow-500' : 'bg-blue-600'} transition-all duration-1000`}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 opacity-50">
              <Star size={10} className="text-primary fill-primary/30" />
              <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">
                Premium
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
