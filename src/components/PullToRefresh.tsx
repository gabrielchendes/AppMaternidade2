import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 80;

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const y = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  // Map pulling distance to a dampened value
  const pullY = useTransform(y, [0, PULL_THRESHOLD * 2], [0, PULL_THRESHOLD]);
  const opacity = useTransform(y, [0, PULL_THRESHOLD], [0, 1]);
  const rotate = useTransform(y, [0, PULL_THRESHOLD], [0, 360]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only pull if we are at the top
      if (window.scrollY === 0) {
        startY.current = e.touches[0].pageY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].pageY;
      const diff = currentY - startY.current;

      if (diff > 0 && window.scrollY <= 0) {
        // We are pulling down at the very top
        if (e.cancelable) {
           e.preventDefault();
        }
        y.set(diff);
        setPullProgress(Math.min(diff / PULL_THRESHOLD, 1));
      } else if (diff < 0) {
        // Pulling up, reset
        y.set(0);
        setPullProgress(0);
        isPulling.current = false;
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      const currentY = y.get();

      if (currentY >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        // Animate to threshold while refreshing
        animate(y, PULL_THRESHOLD, { type: 'spring', damping: 20 });
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          animate(y, 0, { type: 'spring', damping: 20 });
          setPullProgress(0);
        }
      } else {
        // Return to 0
        animate(y, 0, { type: 'spring', damping: 20 });
        setPullProgress(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing, y]);

  return (
    <div ref={containerRef} className="relative overflow-visible">
      {/* Pull Indicator */}
      <motion.div 
        style={{ y: pullY, opacity }}
        className="absolute top-0 left-0 right-0 flex justify-center py-4 pointer-events-none z-[100]"
      >
        <div className="bg-primary/20 backdrop-blur-md border border-primary/30 p-3 rounded-full shadow-lg shadow-primary/20">
          <motion.div
            style={{ rotate: isRefreshing ? undefined : rotate }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
          >
            <RefreshCw className="text-primary w-5 h-5" />
          </motion.div>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: pullY }}>
        {children}
      </motion.div>
    </div>
  );
}
