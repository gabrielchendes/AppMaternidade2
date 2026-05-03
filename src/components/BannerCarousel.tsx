import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BannerCarouselProps {
  images: string[];
  interval?: number;
  config?: Array<{ scale: number, x: number, y: number, stretch?: boolean, link?: string }>;
}

export default function BannerCarousel({ images, interval = 5000, config = [] }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);

    return () => clearInterval(timer);
  }, [images?.length, interval, currentIndex]); // Added currentIndex to reset timer on any change

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
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 }
      }
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 }
      }
    })
  };
  const handleBannerClick = (link?: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <div className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden bg-bg-main">
      <div className="absolute inset-0">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);

              if (swipe < -swipeConfidenceThreshold) {
                next();
              } else if (swipe > swipeConfidenceThreshold) {
                prev();
              }
            }}
            className="absolute inset-0 w-full h-full"
            onClick={() => handleBannerClick(config[currentIndex]?.link)}
          >
            <motion.img
              src={images[currentIndex]}
              loading={currentIndex === 0 ? "eager" : "lazy"}
              style={{ 
                objectFit: config[currentIndex]?.stretch ? 'fill' : 'cover',
                scale: config[currentIndex]?.stretch ? 1 : (config[currentIndex]?.scale ? config[currentIndex].scale / 100 : 1),
                objectPosition: config[currentIndex]?.stretch ? 'center' : (config[currentIndex] ? `${config[currentIndex].x}% ${config[currentIndex].y}%` : '50% 50%'),
                transformOrigin: 'center center'
              }}
              className={`absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing will-change-transform ${config[currentIndex]?.link ? 'cursor-pointer' : ''}`}
              alt={`Banner ${currentIndex + 1}`}
              referrerPolicy="no-referrer"
              draggable="false"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent to-transparent opacity-90 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg-main/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-main/40 via-transparent to-bg-main/40 pointer-events-none" />
    </div>
  );
}
