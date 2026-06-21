import { X, ShoppingBag, Star, Sparkles, CheckCircle2, PlayCircle, ShieldCheck, Zap, ArrowRight, Play, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { memo } from 'react';

interface CoursePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  description: string;
  image: string;
  price: string | number;
  oldPrice?: string | number;
  benefits?: string[];
  ctaText?: string;
  previewEnabled?: boolean;
  previewUrl?: string;
  previewText?: string;
  onPurchase: () => void;
  onPreview?: () => void;
  isLoading?: boolean;
  socialProof?: string;
  showLifetimeBadge?: boolean;
  premiumBadgeText?: string;
  offerBadgeText?: string;
  lifetimeBadgeText?: string;
  paymentLabelText?: string;
  securePaymentLabel?: string;
  instantAccessLabel?: string;
}

const CoursePurchaseModal = memo(({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  image,
  price,
  oldPrice,
  benefits = [],
  ctaText,
  previewEnabled,
  previewUrl,
  previewText,
  onPurchase,
  onPreview,
  isLoading = false,
  socialProof,
  showLifetimeBadge = true,
  premiumBadgeText,
  offerBadgeText,
  lifetimeBadgeText,
  paymentLabelText,
  securePaymentLabel,
  instantAccessLabel
}: CoursePurchaseModalProps) => {

  const formatCurrency = (val: string | number) => {
    if (typeof val === 'number') {
      return (val / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return val;
  };

  const defaultBenefits = [
    { icon: <Zap size={18} />, text: 'Acesso Imediato' },
    { icon: <ShieldCheck size={18} />, text: 'Pagamento Seguro' },
    { icon: <Star size={18} />, text: 'Conteúdo Exclusivo' },
    { icon: <Sparkles size={18} />, text: 'Acesso Vitalício' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-md"
          />
          
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg md:max-w-xl bg-zinc-950 rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(245,158,11,0.15)] border border-white/10 mx-auto my-auto"
            >
              {/* Premium Light Sweep */}
              <motion.div 
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 z-50 pointer-events-none w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
              />

              {/* Close Button */}
            <button
              id="modal-close-btn"
              onClick={onClose}
              className="absolute top-6 right-6 z-50 p-2.5 bg-black/40 hover:bg-white/10 text-white/50 hover:text-white rounded-full transition-all border border-white/5 backdrop-blur-sm"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col">
              {/* Image Section */}
              <div className="relative aspect-video w-full overflow-hidden group border-b border-white/5 bg-zinc-900 flex items-center justify-center">
                <img
                  src={image || `https://picsum.photos/seed/${title}/1200/800`}
                  className="relative z-10 w-full h-full object-cover transition-transform duration-1000 lg:group-hover:scale-[1.02]"
                  alt={title}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                
                {/* Premium Badge */}
                {premiumBadgeText && (
                  <div className="absolute top-4 lg:top-8 left-1/2 -translate-x-1/2 z-30">
                    <div className="flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-full w-fit">
                      <Sparkles size={12} className="text-primary animate-pulse lg:w-3.5 lg:h-3.5" />
                      <span className="text-[8px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] italic whitespace-nowrap">{premiumBadgeText}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="p-6 md:p-10 flex flex-col items-center justify-center bg-zinc-950">
                <div className="space-y-6 md:space-y-8 w-full max-w-sm mx-auto">
                  {/* Header */}
                  <div className="space-y-2 flex flex-col items-center text-center">
                    {offerBadgeText && (
                      <div className="flex items-center gap-2 text-primary font-black text-[9px] lg:text-[10px] tracking-[0.3em] uppercase italic">
                        <Star size={10} className="fill-primary lg:w-3 lg:h-3" /> {offerBadgeText}
                      </div>
                    )}
                    <h2 className="text-2xl lg:text-3xl font-black leading-tight text-white uppercase italic tracking-tighter">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="text-xs font-bold text-gray-500 italic mt-1 line-clamp-2 max-w-[280px]">{subtitle}</p>
                    )}
                  </div>

                  {/* Benefits Grid */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4 py-6 border-y border-white/5">
                    {benefits.length > 0 ? (
                      benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-2 md:gap-3">
                          <div className="mt-1 p-0.5 bg-primary/20 rounded text-primary">
                            <Check size={10} />
                          </div>
                          <span className="text-[9px] lg:text-[10px] font-bold text-gray-300 leading-tight">{benefit}</span>
                        </div>
                      ))
                    ) : (
                      defaultBenefits.map((benefit, index) => (
                        <div key={index} className="flex items-center gap-2 md:gap-3">
                          <div className="p-1 md:p-1.5 bg-white/5 rounded-lg text-gray-500">
                            {benefit.icon}
                          </div>
                          <span className="text-[8px] lg:text-[9px] font-black text-gray-400 uppercase tracking-widest">{benefit.text}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pricing & Social Proof */}
                  <div className="flex flex-col items-center gap-4">
                    {/* Social Proof */}
                    {socialProof && (
                      <div className="flex items-center gap-2 py-1 px-3 md:px-4 bg-primary/5 rounded-full border border-primary/10 w-fit">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center">
                              <Star size={6} className="text-primary fill-primary md:w-2 md:h-2" />
                            </div>
                          ))}
                        </div>
                        <span className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">{socialProof}</span>
                      </div>
                    )}

                    {/* Pricing */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-3">
                        {oldPrice && (
                          <span className="text-base lg:text-lg font-black text-gray-600 line-through italic decoration-primary/50 decoration-2">
                            {formatCurrency(oldPrice)}
                          </span>
                        )}
                        {showLifetimeBadge && (
                          <div className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded flex items-center gap-1">
                            <Check size={8} className="text-green-500 font-black" />
                            <span className="text-[7px] font-black text-green-500 uppercase tracking-widest">{lifetimeBadgeText || 'Vitalício'}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-3xl lg:text-4xl font-black text-white tracking-tighter flex items-center gap-2">
                        {formatCurrency(price)}
                        <span className="text-[8px] lg:text-[9px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{paymentLabelText || 'Pagamento Único'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 md:gap-4 pt-2">
                    <button
                      id="purchase-cta-btn"
                      onClick={onPurchase}
                      disabled={isLoading}
                      className="group relative w-full bg-primary hover:bg-primary-hover text-white font-black py-4 md:py-5 rounded-2xl flex items-center justify-center gap-3 shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_20px_60px_rgba(var(--primary-rgb),0.5)] transition-all active:scale-[0.98] overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      {isLoading ? (
                        <Zap className="animate-spin" size={24} />
                      ) : (
                        <>
                          <ShoppingBag size={18} className="md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
                          <span className="text-xs md:text-sm tracking-[0.1em] uppercase italic">{ctaText || 'Liberar Acesso Agora'}</span>
                          <ArrowRight size={16} className="md:w-[18px] md:h-[18px] translate-x-0 group-hover:translate-x-2 transition-transform" />
                        </>
                      )}
                    </button>

                    {previewEnabled && (
                      <button
                        id="preview-btn"
                        onClick={onPreview}
                        className="w-full py-3 md:py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all border border-white/10 text-[10px] md:text-xs tracking-widest uppercase italic"
                      >
                        <PlayCircle size={16} className="md:w-[18px] md:h-[18px] text-primary" />
                        {previewText || 'Preview do Curso'}
                      </button>
                    )}
                  </div>

                  {/* Trust Footer */}
                  <div className="flex items-center justify-center gap-6 pt-6">
                    <div className="flex items-center gap-2 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                       <ShieldCheck size={12} className="text-green-500/50" /> {securePaymentLabel || 'Pagamento Seguro'}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                       <Zap size={12} className="text-blue-500/50" /> {instantAccessLabel || 'Acesso Instantâneo'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

CoursePurchaseModal.displayName = 'CoursePurchaseModal';

export default CoursePurchaseModal;
