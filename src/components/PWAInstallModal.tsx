import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, PlusSquare, Download, X, Check, Smartphone, Monitor, ChevronLeft, ChevronRight, Apple, Play } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { languagePresets } from '../constants/languagePresets';
import { getDeviceType, setPWADismissed } from '../lib/pwa';
import { useSettings } from '../contexts/SettingsContext';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall?: () => void;
}

interface PWAColumnProps {
  platform: string;
  steps: string[];
  images: string[];
  refObj: React.RefObject<HTMLDivElement | null>;
  slide: number;
  setSlide: (index: number) => void;
  label: string;
  hideLabel?: boolean;
  onManualInteraction?: () => void;
  isAutoScrollingRef: React.MutableRefObject<boolean>;
}

const PWAColumn = ({ platform, steps, images, refObj, slide, setSlide, label, hideLabel, onManualInteraction, isAutoScrollingRef }: PWAColumnProps) => (
  <div className="flex flex-col h-full bg-white/5 rounded-[32px] border border-white/5 shadow-2xl overflow-hidden group/column hover:border-primary/20 transition-all duration-500">
    <div className="p-6 pb-4">
      {!hideLabel && (
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/20 rounded-xl flex-shrink-0 shadow-lg shadow-primary/10">
            {platform === 'ios' ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-primary" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.1 2.48-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.89 1.22-2.11 1.09-3.33-1.04.04-2.3.7-3.05 1.57-.67.77-1.26 2.02-1.11 3.21 1.15.09 2.33-.56 3.07-1.45z"/>
              </svg>
            ) : platform === 'android' ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-primary" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 11c-2.4 0-4.6.4-6.3 1.2L4.4 10c-.1-.2-.4-.3-.6-.2-.2.1-.3.4-.2.6l1.3 2.3c-.1.1-.1.2-.1.3C2.4 14.5.5 17.3.5 20.5h23c0-3.2-1.9-6-4.4-7.5l1.3-2.3c.1-.2 0-.5-.2-.6-.2-.1-.5 0-.6.2l-1.3 2.2C16.6 11.4 14.4 11 12 11zm-5 7c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm10 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z" />
              </svg>
            ) : (
              <Monitor className="w-4 h-4 text-primary" />
            )}
          </div>
          <h4 className="flex-1 text-xs font-black text-white uppercase tracking-widest italic opacity-90 leading-tight">
            {label}
          </h4>
        </div>
      )}

      <div className={`space-y-3 ml-0.5 ${hideLabel ? 'pt-2' : ''}`}>
        {steps.map((step: string, idx: number) => (
          <div key={idx} className="flex items-start gap-3 text-xs text-gray-400 group/item">
            <div className="w-5 h-5 flex items-center justify-center bg-primary text-black rounded-lg flex-shrink-0 font-black italic text-[10px] shadow-md shadow-primary/20 mt-0.5">
              {idx + 1}
            </div>
            <span className="flex-1 leading-tight pt-0.5 font-medium group-hover/item:text-white transition-colors">
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Carousel */}
    <div className={`relative mt-2 ${platform === 'desktop' ? 'h-[600px]' : 'h-[320px]'} bg-black/40 overflow-hidden`}>
      <div 
        ref={refObj}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide-forced"
        onScroll={(e) => {
          if (isAutoScrollingRef.current) return;
          const target = e.currentTarget;
          const width = target.clientWidth;
          if (width <= 0) return;
          const index = Math.round(target.scrollLeft / width);
          if (index !== slide && Math.abs(target.scrollLeft - (index * width)) < 5) {
            setSlide(index);
          }
        }}
        onTouchStart={() => { isAutoScrollingRef.current = false; onManualInteraction?.(); }}
        onMouseDown={() => { isAutoScrollingRef.current = false; onManualInteraction?.(); }}
      >
        {images.map((img: string, idx: number) => (
          <div key={idx} className="min-w-full h-full snap-center flex items-center justify-center p-3 bg-black/20">
            <img src={img} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>
      
      {images.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_: any, idx: number) => (
            <button 
              key={idx}
              onClick={() => {
                isAutoScrollingRef.current = true;
                setSlide(idx);
                onManualInteraction?.();
                setTimeout(() => { isAutoScrollingRef.current = false; }, 600);
              }}
              className={`h-0.5 rounded-full transition-all duration-300 ${
                slide === idx ? 'bg-primary w-3 shadow-[0_0_6px_rgba(var(--primary-rgb),0.5)]' : 'bg-white/20 w-1'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

export default function PWAInstallModal({ isOpen, onClose, onInstall }: PWAInstallModalProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const device = getDeviceType();
  const adminDisplayMode = settings.custom_texts?.['pwa.display_mode'] === 'desktop' ? 'desktop' : 'mobile';
  const showDualMobile = device === 'desktop' && adminDisplayMode === 'mobile';
  
  const [currentSlideIos, setCurrentSlideIos] = useState(0);
  const [currentSlideAndroid, setCurrentSlideAndroid] = useState(0);
  const [currentSlideDesktop, setCurrentSlideDesktop] = useState(0);
  const [resetCounter, setResetCounter] = useState(0);

  const carouselRefIos = useRef<HTMLDivElement>(null);
  const carouselRefAndroid = useRef<HTMLDivElement>(null);
  const carouselRefDesktop = useRef<HTMLDivElement>(null);

  const isAutoScrollingIos = useRef(false);
  const isAutoScrollingAndroid = useRef(false);
  const isAutoScrollingDesktop = useRef(false);

  const handleManualInteraction = () => {
    setResetCounter(prev => prev + 1);
  };

  const intervalSeconds = parseInt(settings.custom_texts?.['pwa.auto_slide_interval'] || '3');

  // Get carousel images from settings or defaults
  const getCarouselImages = (targetDevice: string) => {
    const customImages = settings.custom_texts?.[`pwa.carousel.${targetDevice}`];

    if (customImages) {
      return customImages.split(',').map((url: string) => url.trim()).filter(Boolean);
    }

    // Default placeholders
    const defaults: Record<string, string[]> = {
      ios: [
        'https://picsum.photos/seed/pwa-ios-1/720/1280',
        'https://picsum.photos/seed/pwa-ios-2/720/1280'
      ],
      android: [
        'https://picsum.photos/seed/pwa-android-1/720/1280',
        'https://picsum.photos/seed/pwa-android-2/720/1280'
      ],
      desktop: [
        'https://picsum.photos/seed/pwa-desktop-1/1280/720',
        'https://picsum.photos/seed/pwa-desktop-2/1280/720'
      ]
    };
    return defaults[targetDevice] || defaults.ios;
  };

  const iosImages = getCarouselImages('ios');
  const androidImages = getCarouselImages('android');
  const desktopImages = getCarouselImages('desktop');

  // Get dynamic steps for a specific platform
  const getPlatformSteps = (platform: string) => {
    // Priority 1: Custom JSON steps from settings
    let rawSteps = settings.custom_texts?.[`pwa.steps.${platform}`];

    const oldDefault = '["Toque no ícone de compartilhar", "Selecione \\"Adicionar à Tela de Início\\""]';
    if (platform === 'ios' && (rawSteps === oldDefault || (rawSteps && rawSteps.replace(/\\\\"/g, '"') === oldDefault.replace(/\\\\"/g, '"')))) {
      rawSteps = undefined;
    }

    if (rawSteps) {
      try {
        return JSON.parse(rawSteps);
      } catch (e) {
        return [rawSteps];
      }
    }
    
    // Priority 2: Fallbacks from i18n JSON strings
    const i18nSteps = t(`pwa.steps.${platform}`);
    try {
      if (i18nSteps && i18nSteps !== `pwa.steps.${platform}`) {
        return JSON.parse(i18nSteps);
      }
    } catch (e) { }

    // Priority 3: Individual steps fallbacks
    if (platform === 'ios') {
      const iosSteps = [];
      for (let i = 1; i <= 5; i++) {
        const step = t(`pwa.ios_step${i}`);
        if (step && step !== `pwa.ios_step${i}`) iosSteps.push(step);
      }
      if (iosSteps.length > 0) return iosSteps;
    }

    if (platform === 'android') return [t('pwa.android_step1')];
    if (platform === 'desktop') return [t('pwa.desktop_step1')];
    
    return [t('pwa.ios_step1'), t('pwa.ios_step2')];
  };

  const iosSteps = getPlatformSteps('ios');
  const androidSteps = getPlatformSteps('android');
  const desktopSteps = getPlatformSteps('desktop');

  // Interval handlers
  useEffect(() => {
    if (!isOpen || intervalSeconds <= 0) return;
    const interval = setInterval(() => {
      if (iosImages.length > 1) {
        isAutoScrollingIos.current = true;
        setCurrentSlideIos(p => (p + 1) % iosImages.length);
        setTimeout(() => { isAutoScrollingIos.current = false; }, 600);
      }
      if (androidImages.length > 1) {
        isAutoScrollingAndroid.current = true;
        setCurrentSlideAndroid(p => (p + 1) % androidImages.length);
        setTimeout(() => { isAutoScrollingAndroid.current = false; }, 600);
      }
      if (desktopImages.length > 1) {
        isAutoScrollingDesktop.current = true;
        setCurrentSlideDesktop(p => (p + 1) % desktopImages.length);
        setTimeout(() => { isAutoScrollingDesktop.current = false; }, 600);
      }
    }, intervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [isOpen, intervalSeconds, iosImages.length, androidImages.length, desktopImages.length, resetCounter]);

  // Sync scroll for all carousels
  const syncCarousel = (ref: React.RefObject<HTMLDivElement | null>, currentSlide: number, imagesLength: number) => {
    if (ref.current && imagesLength > 0) {
      const container = ref.current;
      const width = container.clientWidth;
      if (width === 0) return;
      const targetScroll = currentSlide * width;
      if (Math.abs(container.scrollLeft - targetScroll) > width / 10) {
        container.scrollTo({ left: targetScroll, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => syncCarousel(carouselRefIos, currentSlideIos, iosImages.length), [currentSlideIos, iosImages.length, isOpen]);
  useEffect(() => syncCarousel(carouselRefAndroid, currentSlideAndroid, androidImages.length), [currentSlideAndroid, androidImages.length, isOpen]);
  useEffect(() => syncCarousel(carouselRefDesktop, currentSlideDesktop, desktopImages.length), [currentSlideDesktop, desktopImages.length, isOpen]);

  const handleDismiss = () => {
    setPWADismissed(true);
    onClose();
  };

  const currentPlatform = device === 'ios' ? 'ios' : (device === 'android' ? 'android' : adminDisplayMode);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-400">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ 
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.4
            }}
            className={`relative w-full ${showDualMobile ? 'max-w-7xl' : 'max-w-5xl'} bg-zinc-950 border border-white/10 rounded-[64px] overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.9)] flex flex-col max-h-[95vh]`}
          >
            <button 
              onClick={onClose}
              className="absolute top-10 right-10 z-[20] p-4 bg-white/0 hover:bg-white/10 text-gray-500 hover:text-white rounded-[2rem] border border-white/10 hover:border-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-8 sm:p-12">
              <div className={`text-center mb-8 ${showDualMobile ? 'max-w-3xl mx-auto' : ''}`}>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-4 leading-none">
                  {showDualMobile 
                    ? (settings.custom_texts?.['pwa.install_title'] || t('pwa.install_title') || 'Instale nosso aplicativo 📲')
                    : (settings.custom_texts?.[`pwa.${currentPlatform}_label`] || t(`pwa.${currentPlatform}_label`) || settings.custom_texts?.['pwa.install_title'] || t('pwa.install_title'))
                  }
                </h3>
                
                {showDualMobile && (
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic mb-[-0.75rem] relative z-10">
                    {settings.custom_texts?.['pwa.mobile_header'] || t('pwa.mobile_header') || 'Instale no seu celular para uma melhor experiência'}
                  </p>
                )}
              </div>

              <div className={`${showDualMobile ? 'grid grid-cols-2 gap-8' : 'max-w-xl mx-auto'}`}>
                {(currentPlatform === 'ios' || showDualMobile) && (
                  <div className="flex flex-col gap-2">
                    {showDualMobile && (
                      <div className="text-center mb-1">
                        <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">IOS</span>
                      </div>
                    )}
                    <PWAColumn 
                      platform="ios"
                      steps={iosSteps}
                      images={iosImages}
                      refObj={carouselRefIos}
                      slide={currentSlideIos}
                      setSlide={setCurrentSlideIos}
                      label={settings.custom_texts?.['pwa.ios_label'] || t('pwa.ios_label') || 'Apple iOS'}
                      hideLabel={!showDualMobile}
                      onManualInteraction={handleManualInteraction}
                      isAutoScrollingRef={isAutoScrollingIos}
                    />
                  </div>
                )}

                {(currentPlatform === 'android' || showDualMobile) && (
                  <div className="flex flex-col gap-2">
                    {showDualMobile && (
                      <div className="text-center mb-1">
                        <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">Android</span>
                      </div>
                    )}
                    <PWAColumn 
                      platform="android"
                      steps={androidSteps}
                      images={androidImages}
                      refObj={carouselRefAndroid}
                      slide={currentSlideAndroid}
                      setSlide={setCurrentSlideAndroid}
                      label={settings.custom_texts?.['pwa.android_label'] || t('pwa.android_label') || 'Android'}
                      hideLabel={!showDualMobile}
                      onManualInteraction={handleManualInteraction}
                      isAutoScrollingRef={isAutoScrollingAndroid}
                    />
                  </div>
                )}

                {(currentPlatform === 'desktop' && !showDualMobile) && (
                  <PWAColumn 
                    platform="desktop"
                    steps={desktopSteps}
                    images={desktopImages}
                    refObj={carouselRefDesktop}
                    slide={currentSlideDesktop}
                    setSlide={setCurrentSlideDesktop}
                    label={settings.custom_texts?.['pwa.desktop_label'] || t('pwa.desktop_label') || 'Computador'}
                    hideLabel={true}
                    onManualInteraction={handleManualInteraction}
                    isAutoScrollingRef={isAutoScrollingDesktop}
                  />
                )}
              </div>

              <div className={`mt-8 space-y-8 ${showDualMobile ? 'max-w-2xl mx-auto' : 'max-w-lg mx-auto'}`}>
                <p className="text-xs text-gray-400 font-medium text-center leading-relaxed px-8">
                  {settings.custom_texts?.['pwa.install_desc'] || t('pwa.install_desc') || 'Tenha acesso rápido e notificações exclusivas direto no seu dispositivo.'}
                </p>

                <div className="grid grid-cols-2 gap-4 px-4">
                  <button
                    onClick={async () => {
                      const isGotItMode = (device === 'ios' || showDualMobile || adminDisplayMode === 'mobile');
                      if (isGotItMode) {
                        onClose();
                      } else if (onInstall) {
                        try {
                          // Call onInstall but don't strictly wait for success to close,
                          // as native prompt behavior can vary across browsers and might not return true/false reliably
                          await (onInstall as any)();
                          onClose();
                        } catch (e) {
                          onClose();
                        }
                      } else {
                        onClose();
                      }
                    }}
                    className="group relative overflow-hidden flex items-center justify-center gap-4 py-5 px-6 bg-primary text-black font-black uppercase tracking-tighter rounded-3xl hover:brightness-110 active:scale-95 transition-all text-sm shadow-2xl shadow-primary/30"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    {(device === 'ios' || showDualMobile || adminDisplayMode === 'mobile') ? (t('pwa.got_it') || 'ENTENDI') : (settings.custom_texts?.['pwa.install_button'] || t('pwa.install_button') || 'INSTALAR')}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="flex items-center justify-center gap-3 py-5 px-6 bg-white/5 border border-white/5 text-gray-500 font-black uppercase tracking-tighter rounded-3xl hover:bg-white/10 active:scale-95 transition-all text-sm"
                  >
                    <Check className="w-5 h-5 shrink-0" />
                    {settings.custom_texts?.['pwa.already_installed'] || t('pwa.already_installed') || 'OK'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
