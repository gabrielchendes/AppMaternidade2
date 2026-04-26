import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, PlusSquare, Download, X, Check, Smartphone, Monitor, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { getDeviceType, setPWADismissed } from '../lib/pwa';
import { useSettings } from '../contexts/SettingsContext';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall?: () => void;
}

export default function PWAInstallModal({ isOpen, onClose, onInstall }: PWAInstallModalProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const device = getDeviceType();
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const intervalSeconds = parseInt(settings.custom_texts?.['pwa.auto_slide_interval'] || '3');

  // Get carousel images from settings or defaults
  const getCarouselImages = () => {
    const customImages = settings.custom_texts?.[`pwa.carousel.${device}`];

    if (customImages) {
      return customImages.split(',').map((url: string) => url.trim()).filter(Boolean);
    }

    // Default placeholders
    const defaults = {
      ios: [
        'https://picsum.photos/seed/pwa-ios-1/720/1280',
        'https://picsum.photos/seed/pwa-ios-2/720/1280'
      ],
      android: [
        'https://picsum.photos/seed/pwa-android-1/720/1280',
        'https://picsum.photos/seed/pwa-android-2/720/1280'
      ],
      desktop: [
        'https://picsum.photos/seed/pwa-desktop-1/1920/1080',
        'https://picsum.photos/seed/pwa-desktop-2/1920/1080'
      ]
    };
    return defaults[device];
  };

  const images = getCarouselImages();

  // Get dynamic steps
  const getSteps = () => {
    const rawSteps = settings.custom_texts?.[`pwa.steps.${device}`];

    if (rawSteps) {
      try {
        return JSON.parse(rawSteps);
      } catch (e) {
        return [rawSteps];
      }
    }
    
    // Fallbacks
    if (device === 'ios') return [t('pwa.ios_step1'), t('pwa.ios_step2')];
    if (device === 'android') return [t('pwa.android_step1')];
    return [t('pwa.desktop_step1')];
  };

  const steps = getSteps();

  useEffect(() => {
    if (!isOpen || images.length <= 1 || intervalSeconds <= 0) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % images.length);
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [isOpen, images.length, intervalSeconds]); // Removed currentSlide to prevent interval reset

  // Sync scroll position with currentSlide
  useEffect(() => {
    if (carouselRef.current && images.length > 0) {
      const container = carouselRef.current;
      const width = container.clientWidth;
      if (width === 0) return;
      const targetScroll = currentSlide * width;
      
      // Use a slightly larger threshold to prevent fighting with native momentum scroll
      if (Math.abs(container.scrollLeft - targetScroll) > width / 10) {
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    }
  }, [currentSlide, images.length, isOpen]);

  const handleDismiss = () => {
    setPWADismissed(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-[20] p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex-1 overflow-y-auto scrollbar-hide bg-zinc-900">
            {/* Header */}
            <div className="p-6 text-center space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                {settings.custom_texts?.['pwa.install_title'] || t('pwa.install_title') || 'Instale nosso aplicativo 📲'}
              </h3>
              <p className="text-sm text-gray-400 font-medium px-4">
                {settings.custom_texts?.['pwa.install_desc'] || t('pwa.install_desc') || 'Tenha acesso rápido, sem precisar abrir o navegador'}
              </p>
            </div>

            {/* Carousel */}
            <div className="relative h-80 bg-black/40 overflow-hidden group/carousel">
              <div 
                ref={carouselRef}
                className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide-forced transition-all duration-300 scroll-smooth"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const width = target.clientWidth;
                  if (width <= 0) return;
                  
                  const index = Math.round(target.scrollLeft / width);
                  // Only update state if it's a stable index and different from current
                  // This prevents the carousel from "snapping back" during automatic smooth scroll
                  if (index !== currentSlide && Math.abs(target.scrollLeft - (index * width)) < 5) {
                    setCurrentSlide(index);
                  }
                }}
              >
                {images.map((img: string, idx: number) => (
                  <div key={idx} className="min-w-full h-full snap-center flex items-center justify-center p-2 bg-black/20">
                    <img 
                      src={img} 
                      alt={`Step ${idx + 1}`}
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
              
              {/* Indicators */}
              {images.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {images.map((_: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        if (carouselRef.current) {
                          carouselRef.current.scrollTo({
                            left: idx * carouselRef.current.clientWidth,
                            behavior: 'smooth'
                          });
                        }
                      }}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        currentSlide === idx ? 'bg-primary w-6 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-white/20 w-1.5'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Instructions Content */}
            <div className="p-6 space-y-8">
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 shadow-inner">
                <div className="p-3 bg-primary/20 rounded-2xl flex-shrink-0 shadow-lg shadow-primary/10">
                  {device === 'ios' ? <Smartphone className="w-6 h-6 text-primary" /> :
                   device === 'android' ? <Smartphone className="w-6 h-6 text-primary" /> :
                   <Monitor className="w-6 h-6 text-primary" />}
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-widest italic opacity-80 mb-3">
                    {device === 'ios' ? (settings.custom_texts?.['pwa.ios_label'] || t('pwa.ios_label') || 'Instale manualmente no seu iPhone') :
                     device === 'android' ? (settings.custom_texts?.['pwa.android_label'] || t('pwa.android_label') || 'Instale com um clique') :
                     (settings.custom_texts?.['pwa.desktop_label'] || t('pwa.desktop_label') || 'Instale direto no seu computador')}
                  </h4>
                  <div className="space-y-3">
                    {steps.map((step: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 text-xs text-gray-400 group/item">
                        <div className="w-6 h-6 flex items-center justify-center bg-primary text-black rounded-lg flex-shrink-0 font-black italic text-[10px] shadow-lg shadow-primary/20">
                          {idx + 1}
                        </div>
                        <span className="leading-tight pt-1 font-medium group-hover/item:text-white transition-colors">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-2">
                <button
                  onClick={async () => {
                   if (device === 'android' || device === 'desktop') {
                      if (onInstall) {
                        const success = await (onInstall as any)();
                        if (!success) {
                          alert('Dica: Procure o ícone de instalação (monitor com seta) na barra de endereços do seu navegador ou no menu de opções.');
                        }
                        if (success) onClose();
                      }
                    } else {
                      onClose();
                    }
                  }}
                  className="group relative overflow-hidden flex items-center justify-center gap-2 py-4 px-4 bg-primary text-black font-black uppercase tracking-tighter rounded-2xl hover:brightness-110 active:scale-95 transition-all text-[11px] shadow-xl shadow-primary/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {device === 'ios' ? (t('pwa.got_it') || 'ENTENDI') : (settings.custom_texts?.['pwa.install_button'] || t('pwa.install_button') || 'INSTALAR AGORA')}
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex items-center justify-center gap-2 py-4 px-4 bg-white/5 border border-white/5 text-gray-400 font-bold uppercase tracking-tighter rounded-2xl hover:bg-white/10 active:scale-95 transition-all text-[11px]"
                >
                  <Check className="w-4 h-4" />
                  {settings.custom_texts?.['pwa.already_installed'] || t('pwa.already_installed') || 'JÁ INSTALEI'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
