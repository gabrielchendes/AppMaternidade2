import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BannerCarouselProps {
  images: string[];
  interval?: number;
  config?: Array<{ scale: number, x: number, y: number, stretch?: boolean, link?: string }>;
}

const BannerCarousel = memo(({ images, interval = 5000, config = [] }: BannerCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!images || images.length <= 1) return;

    // Pre-cache next image
    const nextIndex = (currentIndex + 1) % images.length;
    const nextImg = new Image();
    nextImg.src = images[nextIndex];

    const timer = setInterval(() => {
      if (!isDragging) {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [images?.length, interval, currentIndex, isDragging]);

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
      scale: 0.85,
      rotateY: direction > 0 ? 45 : -45,
      zIndex: 1
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        x: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any },
        opacity: { duration: 0.5 },
        scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any },
        rotateY: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
      scale: 0.85,
      rotateY: direction > 0 ? -45 : 45,
      transition: {
        x: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any },
        opacity: { duration: 0.4 },
        scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any },
        rotateY: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }
      }
    })
  };
  const handleBannerClick = (link?: string) => {
    if (link && !isDragging) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const swipeConfidenceThreshold = 5000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <div className="relative w-full h-[46vh] md:h-[60vh] overflow-hidden bg-bg-main">
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
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);

              if (swipe < -swipeConfidenceThreshold) {
                next();
              } else if (swipe > swipeConfidenceThreshold) {
                prev();
              }
              
              // Use a small timeout to unset isDragging so the click event is filtered out correctly
              setTimeout(() => setIsDragging(false), 50);
            }}
            className="absolute inset-0 w-full h-full"
            style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
            onClick={() => handleBannerClick(config[currentIndex]?.link)}
          >
            <motion.img
              src={images[currentIndex]}
              loading={currentIndex === 0 ? "eager" : "lazy"}
              initial={false}
              animate={{ 
                scale: config[currentIndex]?.stretch ? 1 : [(config[currentIndex]?.scale ? config[currentIndex].scale / 100 : 1) * 1, (config[currentIndex]?.scale ? config[currentIndex].scale / 100 : 1) * 1.03],
              }}
              transition={{
                scale: {
                  duration: 20,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "linear"
                }
              }}
              style={{ 
                objectFit: config[currentIndex]?.stretch ? 'fill' : 'cover',
                objectPosition: config[currentIndex]?.stretch ? 'center' : (config[currentIndex] ? `${config[currentIndex].x}% ${config[currentIndex].y}%` : '50% 50%'),
                transformOrigin: 'center center'
              }}
              className={`absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing will-change-[transform,opacity] ${config[currentIndex]?.link ? 'cursor-pointer' : ''}`}
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
});

export default BannerCarousel;
