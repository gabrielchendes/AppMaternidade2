import React from 'react';
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

export default function ProductCard({ product, isUnlocked, progress, stats, onOpen }: ProductCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="relative flex-shrink-0 w-48 sm:w-64 cursor-pointer group"
      onClick={() => onOpen(product)}
    >
      {/* Cover Image */}
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-800 border border-white/10 mb-4 shadow-xl">
        <img
          src={product.cover_url || `https://picsum.photos/seed/${product.id}/800/450`}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Status Badge */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isUnlocked && progress === 100 && (
            <span className="px-2 py-1 bg-green-500/80 backdrop-blur-md text-[10px] font-black text-white rounded-lg border border-white/10 uppercase tracking-tighter flex items-center gap-1">
              <CheckCircle2 size={10} /> Concluído
            </span>
          )}
        </div>
        
        {/* Lock Overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-black/60 p-4 rounded-full backdrop-blur-md border border-white/10 shadow-2xl scale-90 group-hover:scale-100 transition-transform">
              <Lock size={32} className="text-red-500 fill-red-500/10" />
            </div>
          </div>
        )}

        {/* Play Icon on Hover (if unlocked) */}
        {isUnlocked && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-primary p-4 rounded-full shadow-2xl shadow-primary/40 scale-90 group-hover:scale-100 transition-transform">
              <Play size={32} className="text-white fill-white" />
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isUnlocked && progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
            />
          </div>
        )}
      </div>

      {/* Info Below Image */}
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-primary transition-colors truncate">
            {product.title}
          </h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
          {product.description || 'Conteúdo exclusivo para membros da Maternidade Premium.'}
        </p>
        
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-600 uppercase tracking-widest">
            <Play size={12} /> {stats?.lessons || 0} Aulas
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-600 uppercase tracking-widest">
            <FileText size={12} /> {stats?.materials || 0} Materiais
          </div>
        </div>
      </div>
    </motion.div>
  );
}
