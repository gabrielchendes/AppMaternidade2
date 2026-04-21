import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BannerCarouselProps {
  images: string[];
  interval?: number;
}

export default function BannerCarousel({ images, interval = 5000 }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);

    return () => clearInterval(timer);
  }, [images?.length, interval]);

  if (!images || images.length === 0) return null;

  const next = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };
  const prev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.1
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95
    })
  };

  return (
    <div className="relative w-full h-[65vh] md:h-[85vh] overflow-hidden bg-bg-main">
      <div className="absolute inset-0">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.4 },
              scale: { duration: 0.6 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = Math.abs(offset.x) * velocity.x;
              if (swipe < -10000) {
                next();
              } else if (swipe > 10000) {
                prev();
              }
            }}
            className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing will-change-transform"
            alt={`Banner ${currentIndex + 1}`}
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent to-transparent opacity-90 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg-main/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-main/40 via-transparent to-bg-main/40 pointer-events-none" />

      {/* Navigation Controls */}
      {images.length > 1 && (
        <>
          {/* Indicators */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === currentIndex ? 'bg-primary w-10' : 'bg-white/20 w-4 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
