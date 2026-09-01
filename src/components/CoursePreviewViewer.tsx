import React, { useEffect } from 'react';
import { 
  X, 
  ShoppingBag, 
  ShieldCheck, 
  Zap, 
  Check, 
  ArrowRight,
  PlayCircle,
  Star,
  Users,
  Shield,
  Award,
  ArrowLeft,
  Lock,
  Sparkles,
  Maximize2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course } from '../types/lms';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import SupportSection from './SupportSection';
import FloatingWhatsApp from './FloatingWhatsApp';

interface CoursePreviewViewerProps {
  course: Course;
  onClose: () => void;
  onPurchase: () => void;
}

export default function CoursePreviewViewer({ course, onClose, onPurchase }: CoursePreviewViewerProps) {
  const { settings } = useSettings();
  const { t } = useI18n();

  const formatCurrency = (val: number) => {
    return (val / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const rating = course.preview_rating || '4.98 Avaliação';
  const students = course.preview_students_label || '1.2k+';
  const guarantee = course.preview_guarantee_label || '7 Dias';
  const support = course.preview_support_vip_label || '24/7';
  const bonusTitle = course.preview_bonus_title || 'Bônus Exclusivos inclusos';

  useEffect(() => {
    // Track modal state in history to handle browser back button
    const originalHash = window.location.hash;
    window.history.pushState({ modal: 'preview' }, '', '#preview');

    const handlePopState = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up hash if needed
      if (window.location.hash === '#preview') {
        window.history.replaceState(null, '', originalHash || '#home');
      }
    };
  }, [onClose]);

  const renderPreviewContent = () => {
    const type = course.preview_type || 'video';
    
    if (type === 'video') {
      const videoUrl = course.preview_video_url || course.preview_url || '';
      const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
      const isVimeo = videoUrl.includes('vimeo.com');
      const isDrive = videoUrl.includes('drive.google.com');

      const getEmbedUrl = () => {
        if (isYouTube) {
          const id = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop()?.split('?')[0];
          return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
        }
        if (isVimeo) {
          const id = videoUrl.split('/').pop()?.split('?')[0];
          return `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0&playsinline=1`;
        }
        if (isDrive) {
          const id = videoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || videoUrl.match(/id=([a-zA-Z0-9_-]+)/)?.[1] || videoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
          return `https://drive.google.com/file/d/${id}/preview`;
        }
        if (videoUrl.includes('iframe.videodelivery.net')) {
          return videoUrl;
        }
        if (videoUrl.includes('cloudflarestream.com') || videoUrl.includes('videodelivery.net')) {
          const streamId = videoUrl.split('/').pop()?.split('?')[0];
          return `https://iframe.videodelivery.net/${streamId}`;
        }
        return videoUrl;
      };

      const isDirectOrCloudflare = videoUrl.includes('r2.dev') || 
                                  videoUrl.includes('cloudflare') || 
                                  videoUrl.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i);

      return (
        <div className="relative aspect-video w-full bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
          {isYouTube || isVimeo || isDrive || videoUrl.includes('videodelivery.net') || videoUrl.includes('cloudflarestream.com') ? (
            <iframe
              src={getEmbedUrl()}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              webkit-playsinline="true"
              preload="metadata"
            />
          )}
        </div>
      );
    }

    if (type === 'pdf') {
      let viewerUrl = '';
      if ((course.preview_pdf_url || '').includes('drive.google.com')) {
        const fileId = (course.preview_pdf_url || '').match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || 
                       (course.preview_pdf_url || '').match(/id=([a-zA-Z0-9_-]+)/)?.[1] || 
                       (course.preview_pdf_url || '').match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        viewerUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : (course.preview_pdf_url || '');
      } else {
        const encodedUrl = encodeURIComponent(course.preview_pdf_url || '');
        viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
      }

      return (
        <div className="relative aspect-[1/1.4] sm:aspect-[3/4] w-full bg-[#1a1a1a] rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 ring-8 ring-white/5">
          {/* Subtle Paper Texture Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
          
          <iframe 
            src={viewerUrl}
            className="w-full h-full border-none relative z-10"
            title={course.title}
            allow="fullscreen"
            loading="lazy"
          />
          
          {/* Elegant Book Binding Shadow Effect */}
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/40 to-transparent z-20 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-black/20 to-transparent z-20 pointer-events-none" />

          {/* Fullscreen Trigger Overlay */}
          <div className="absolute top-6 right-6 z-50">
            <a 
              href={course.preview_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary hover:bg-primary/90 text-black p-4 rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-[0_8px_32px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center group/btn cursor-pointer"
              title="Ver em Tela Cheia"
            >
              <Maximize2 size={24} className="group-hover/btn:rotate-12 transition-transform" />
            </a>
          </div>
        </div>
      );
    }

    if (type === 'link') {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <a 
            href={course.preview_link_url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ backgroundColor: course.preview_link_color || '#3b82f6' }}
            className="px-12 py-5 text-white rounded-2xl font-black uppercase text-sm tracking-widest transition-all hover:brightness-110 active:scale-95 shadow-2xl shadow-primary/20"
          >
            {course.preview_link_text || 'ACESSAR AGORA'}
          </a>
        </div>
      );
    }

    if (type === 'text') {
      return (
        <div className="relative w-full aspect-[1/1.4] sm:aspect-[3/4] bg-white rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
           <iframe
             srcDoc={`
               <!DOCTYPE html>
               <html>
                 <head>
                   <meta charset="utf-8">
                   <meta name="viewport" content="width=device-width, initial-scale=1">
                   <style>
                     body { 
                       margin: 0; 
                       padding: 20px; 
                       font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                       color: #1a1a1a;
                       background: white;
                     }
                     img { max-width: 100%; height: auto; }
                   </style>
                 </head>
                 <body>
                   ${course.preview_rich_text || ''}
                 </body>
               </html>
             `}
             className="w-full h-full border-0"
             title="HTML Preview"
           />
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-zinc-950 overflow-y-auto overflow-x-hidden pt-safe pb-32 lg:pb-20"
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] right-[-10%] w-[50%] aspect-square bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] aspect-square bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Sticky Container */}
      <div className="sticky top-0 z-[60] w-full px-6 py-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <button 
          onClick={onClose}
          className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl lg:rounded-2xl text-gray-400 hover:text-white transition-all border border-white/5 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        
        <div className="flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-0.5 shadow-lg shadow-primary/10">
            <Sparkles size={10} className="text-primary animate-pulse" />
            <span className="text-[8px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none">
              {settings.custom_texts?.['course.preview_badge'] || t('course.preview_badge') || 'PREVIEW'}
            </span>
          </div>
          <span className="text-[10px] lg:text-xs font-black text-white/50 uppercase tracking-tighter truncate max-w-[150px] lg:max-w-[300px] text-center italic">
            {course.title}
          </span>
        </div>

        <button 
          onClick={onClose}
          className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl lg:rounded-2xl text-gray-400 hover:text-white transition-all border border-white/5"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 lg:py-16">
        <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-20 items-start">
          
          {/* Main Content Area */}
          <div className="space-y-12 lg:space-y-16">
            
            {/* Hero Section */}
            <div className="space-y-8">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="space-y-6 text-center lg:text-left"
              >
                <div className="flex flex-col items-center lg:items-start gap-4">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <div className="flex items-center -space-x-1 mr-1">
                      {[1,2,3,4,5].map(v => <Star key={v} size={10} className="text-amber-500 fill-amber-500 shadow-sm" />)}
                    </div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{rating}</span>
                  </div>
                  
                  <h1 className="text-3xl lg:text-6xl font-black text-white italic uppercase tracking-tighter leading-[1.05]">
                    {course.preview_title || course.title}
                  </h1>

                  {(course.preview_subtitle || course.subtitle) && (
                    <p className="text-lg lg:text-2xl font-bold text-gray-400 leading-relaxed uppercase tracking-tight max-w-2xl">
                      {course.preview_subtitle || course.subtitle}
                    </p>
                  )}
                </div>

                {/* Main Asset Player */}
                <div className="pt-2">
                  {renderPreviewContent()}
                </div>
              </motion.div>
            </div>

            {/* Value Proposition */}
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                    <Award size={16} />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{course.preview_modules_label || 'O que te espera lá dentro'}</h3>
                </div>
                
                <div className="p-8 rounded-[2rem] bg-zinc-900/40 border border-white/5 backdrop-blur-sm">
                  <p className="text-zinc-400 text-lg lg:text-xl leading-relaxed font-medium whitespace-pre-line">
                    {course.description}
                  </p>
                </div>
              </div>

              {/* Stats / Social Proof Grid */}
              {course.preview_show_social_proof !== false && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex flex-col items-center text-center group hover:bg-white/10 transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                        <Users size={24} />
                      </div>
                      <span className="text-2xl font-black text-white leading-none">{students}</span>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">{course.preview_students_tag || t('stats.students')}</span>
                  </div>
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex flex-col items-center text-center group hover:bg-white/10 transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                        <Shield size={24} />
                      </div>
                      <span className="text-2xl font-black text-white leading-none">{guarantee}</span>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">{course.preview_risk_zero_label || 'Risque Zero'}</span>
                  </div>
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex flex-col items-center text-center group hover:bg-white/10 transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                        <Zap size={24} />
                      </div>
                      <span className="text-2xl font-black text-white leading-none">{support}</span>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">{course.preview_support_label || 'Acompanhamento'}</span>
                  </div>
                </div>
              )}

              {/* Guarantee Box */}
              <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                  <ShieldCheck size={120} className="text-emerald-500" />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 font-black text-[10px] uppercase tracking-widest italic">
                    {course.preview_guarantee_title || `Garantia Incondicional de ${guarantee}`}
                  </div>
                  <h4 className="text-2xl lg:text-3xl font-black text-white uppercase italic tracking-tighter">{course.preview_guarantee_subtitle || 'Sua satisfação ou seu dinheiro de volta'}</h4>
                  <p className="text-gray-400 font-medium text-lg leading-relaxed max-w-2xl whitespace-pre-wrap">
                    {course.preview_guarantee_description || `Eu tiro todo o risco das suas costas. Se em até ${guarantee} você sentir que o curso não é para você, basta solicitar o reembolso que devolvemos 100% do seu investimento. Sem burocracia, preto no branco.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Conversion Area */}
          <div className="lg:sticky lg:top-28 space-y-8">
            <div className="relative p-10 rounded-[3rem] bg-zinc-900 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Background Accents */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />
              
              <div className="relative z-10 space-y-10">
                {/* Price Section */}
                <div className="text-center space-y-3">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Investimento Único</span>
                  <div className="flex flex-col items-center">
                    {course.old_price && course.old_price > 0 && (
                      <span className="text-sm font-black text-gray-600 line-through opacity-40 italic">
                        {formatCurrency(course.old_price)}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-5xl lg:text-6xl font-black text-white tracking-tighter italic">
                        {formatCurrency(course.price)}
                      </span>
                    </div>
                  </div>
                  
                  {course.social_proof && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <div className="flex -space-x-1.5">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-5 h-5 rounded-full border border-zinc-900 bg-zinc-800 flex items-center justify-center overflow-hidden">
                            <img src={`https://i.pravatar.cc/50?u=${i+course.id}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest italic">{course.social_proof}</span>
                    </div>
                  )}
                </div>

                {/* Purchase Button */}
                <div className="space-y-4">
                  <button 
                    onClick={onPurchase}
                    className="w-full group/buy relative"
                  >
                    <div className="absolute -inset-1 bg-primary blur-2xl opacity-20 group-hover/buy:opacity-40 transition-opacity" />
                    <div className="relative bg-primary hover:bg-primary-hover text-white font-black py-7 rounded-[1.5rem] flex items-center justify-center gap-3 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <ShoppingBag size={20} className="group-hover:rotate-12 transition-transform" />
                      <span className="text-base tracking-[0.1em] uppercase italic">
                        {course.cta_text || 'GARANTIR MINHA VAGA'}
                      </span>
                      <ArrowRight size={18} className="group-hover/buy:translate-x-1 transition-transform" />
                    </div>
                  </button>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center italic">
                    {course.preview_footer_cta || 'Aproveite as condições especiais de lançamento'}
                  </p>
                </div>

                {/* Benefits / Bonus List */}
                {course.preview_show_bonus !== false && (
                  <div className="space-y-6 pt-4 border-t border-white/5">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-center">
                      {bonusTitle}
                    </h4>
                    <div className="grid gap-3">
                      {(course.benefits?.length ? course.benefits : ['Acesso Vitalício', 'Suporte Especializado', 'Certificado Digital']).map((benefit, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 group/benefit cursor-default hover:bg-white/10 transition-colors">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <Check size={14} strokeWidth={3} />
                          </div>
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-tight leading-none">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Trust Info */}
                {course.preview_show_trust !== false && (
                   <div className="pt-6 space-y-6">
                     <div className="flex items-center justify-center gap-8 py-2 border-y border-white/5">
                       <div className="flex flex-col items-center gap-2 group cursor-default">
                         <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                           <ShieldCheck size={20} />
                         </div>
                         <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Pagamento Seguro</span>
                       </div>
                       <div className="flex flex-col items-center gap-2 group cursor-default">
                         <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                           <Zap size={20} />
                         </div>
                         <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Acesso Instantâneo</span>
                       </div>
                     </div>
                   </div>
                )}
              </div>
            </div>

            {/* Mobile Sticky CTA Trigger (Visible only if scrolled) */}
            <div className="lg:hidden p-6 bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] flex items-center justify-between gap-4">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Preço Especial</span>
                  <span className="text-2xl font-black text-white italic tracking-tighter">{formatCurrency(course.price)}</span>
               </div>
               <button 
                 onClick={onPurchase}
                 className="px-8 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 active:scale-95"
               >
                 COMPRAR
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation for Mobile */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="lg:hidden fixed bottom-6 left-6 right-6 z-[100]"
      >
        <button 
          onClick={onPurchase}
          className="w-full bg-primary hover:bg-primary-hover text-white h-16 rounded-2xl flex items-center justify-center gap-3 shadow-[0_20px_50px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-all"
        >
          <ShoppingBag size={20} />
          <span className="text-sm font-black uppercase tracking-widest italic">{course.cta_text || 'INSCREVER AGORA'}</span>
          <ArrowRight size={18} />
        </button>
      </motion.div>

      <div className="max-w-4xl mx-auto w-full pb-32">
        <SupportSection page="preview" settings={settings} t={t} />
      </div>

      <FloatingWhatsApp page="preview" />
    </motion.div>
  );
}
