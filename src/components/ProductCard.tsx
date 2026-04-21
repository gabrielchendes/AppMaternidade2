import React, { memo } from 'react';
import { Lock, Play, FileText, CheckCircle2 } from 'lucide-react';
import { Course } from '../types/lms';
import { motion } from 'motion/react';

interface ProductCardProps {
  product: Course;
  isUnlocked: boolean;
  progress?: number;
  stats?: { lessons: number, materials: number };
  onOpen: (product: Course) => void;
}

const ProductCard = memo(({ product, isUnlocked, progress, stats, onOpen }: ProductCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className="relative flex-shrink-0 w-36 sm:w-44 cursor-pointer group rounded-xl overflow-hidden shadow-2xl bg-zinc-900 border border-white/5"
      onClick={() => onOpen(product)}
    >
      {/* Cover Image - Netflix vertical style */}
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={product.cover_url || `https://picsum.photos/seed/${product.id}/400/600`} // Reduced size for cards
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />

        {/* Lock Overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
            <Lock size={24} className="text-white/50" />
          </div>
        )}

        {/* Info Overlay (Netflix Style) */}
        <div className={`absolute inset-x-0 bottom-0 p-3 space-y-1 ${isUnlocked && progress !== undefined && progress > 0 ? 'pb-7' : ''}`}>
          <h3 className="font-black text-sm sm:text-base text-white leading-tight line-clamp-2 drop-shadow-lg">
            {product.title}
          </h3>
          <p className="text-[10px] font-black text-primary uppercase tracking-tighter drop-shadow-lg">
            {product.description?.split('.')[0] || 'Premium'}
          </p>
        </div>

        {/* Progress Bar & Percentage */}
        {isUnlocked && progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2 pt-1 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-primary shadow-[0_0_8px_rgba(236,72,153,0.5)]"
                />
              </div>
              <span className="text-[10px] font-black text-white italic drop-shadow-md shrink-0">
                {progress}%
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default ProductCard;
