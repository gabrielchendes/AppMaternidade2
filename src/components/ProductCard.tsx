import { Lock } from 'lucide-react';
import { Product } from '../lib/supabase';

interface ProductCardProps {
  product: Product;
  isUnlocked: boolean;
  onOpen: (product: Product) => void;
  key?: string | number;
}

export default function ProductCard({ product, isUnlocked, onOpen }: ProductCardProps) {
  return (
    <div
      className="relative flex-shrink-0 w-40 sm:w-52 cursor-pointer group"
      onClick={() => onOpen(product)}
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 border border-white/5 mb-3">
        <img
          src={product.cover_url || `https://picsum.photos/seed/${product.id}/400/600`}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        {/* Lock Overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-black/60 p-3 rounded-full backdrop-blur-sm border border-white/10">
              <Lock size={32} className="text-red-600 fill-red-600/20" />
            </div>
          </div>
        )}
      </div>

      {/* Info Below Image */}
      <div className="space-y-1">
        <h3 className="font-bold text-sm sm:text-base group-hover:text-primary transition-colors">
          {product.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-gray-400 leading-tight">
          {product.description || 'Conteúdo exclusivo para membros da Maternidade Premium.'}
        </p>
      </div>
    </div>
  );
}
