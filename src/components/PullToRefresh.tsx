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
  const [isTriggered, setIsTriggered] = useState(false);
  const y = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const hasVibrated = useRef(false);

  // Map pulling distance to a dampened value (feels like real rubber band resistance)
  const pullY = useTransform(y, (val) => {
    if (val <= 0) return 0;
    // Logarithmic curve to simulate native spring resistance
    return PULL_THRESHOLD * Math.log1p(val / PULL_THRESHOLD);
  });

  // Smooth opacity and rotation
  const opacity = useTransform(y, [0, PULL_THRESHOLD], [0, 1]);
  const rotate = useTransform(y, [0, PULL_THRESHOLD * 1.5], [0, 360]);
  
  // Dynamic scale of the refresh node: starts small, pops slightly when triggered
  const scale = useTransform(y, [0, PULL_THRESHOLD], [0.65, 1]);

  const isAtTop = () => {
    if (window.scrollY > 0) return false;
    if (containerRef.current) {
      let el: HTMLElement | null = containerRef.current;
      while (el) {
        if (el.scrollTop > 1) {
          return false;
        }
        el = el.parentElement;
      }
    }
    return true;
  };

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      if (isAtTop()) {
        startX.current = e.touches[0].pageX;
        startY.current = e.touches[0].pageY;
        isPulling.current = true;
        hasVibrated.current = false;
        setIsTriggered(false);
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentX = e.touches[0].pageX;
      const currentY = e.touches[0].pageY;
      const diffY = currentY - startY.current;
      const diffX = Math.abs(currentX - startX.current);

      // If user is swiping horizontally, cancel pull-to-refresh so card carousels scroll freely
      if (diffX > Math.abs(diffY)) {
        isPulling.current = false;
        y.set(0);
        setIsTriggered(false);
        return;
      }

      if (diffY > 15 && isAtTop()) {
        // Prevent default browser rubber-banding/pull-to-refresh on mobile when intentionally pulling down
        if (e.cancelable) {
          e.preventDefault();
        }
        
        y.set(diffY);
        
        // Calculate the dampened position to see if we reached threshold
        const currentPullY = PULL_THRESHOLD * Math.log1p(diffY / PULL_THRESHOLD);
        const triggered = currentPullY >= PULL_THRESHOLD * 0.9;
        
        setIsTriggered(triggered);
        
        if (triggered && !hasVibrated.current) {
          if (navigator.vibrate) {
            try {
              navigator.vibrate(10);
            } catch (err) {
              // Ignore silent errors
            }
          }
          hasVibrated.current = true;
        } else if (!triggered) {
          hasVibrated.current = false;
        }
      } else if (diffY < 0) {
        y.set(0);
        setIsTriggered(false);
        isPulling.current = false;
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      // Compute actual interactive position
      const currentPullY = PULL_THRESHOLD * Math.log1p(y.get() / PULL_THRESHOLD);

      if (currentPullY >= PULL_THRESHOLD * 0.9) {
        setIsRefreshing(true);
        setIsTriggered(true);
        
        // Direct, smooth settle to threshold while refreshing (no rapid spring bouncing/shaking)
        animate(y, PULL_THRESHOLD, { 
          type: 'tween',
          ease: 'easeOut',
          duration: 0.25
        });
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setIsTriggered(false);
          animate(y, 0, { 
            type: 'tween',
            ease: 'easeOut',
            duration: 0.25
          });
        }
      } else {
        // Smooth return to 0
        animate(y, 0, { 
          type: 'tween',
          ease: 'easeOut',
          duration: 0.22
        });
        setIsTriggered(false);
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
        style={{ opacity, scale }}
        className="absolute top-0 left-0 right-0 flex justify-center py-5 pointer-events-none z-[100]"
      >
        <div className={`
          p-3 rounded-full shadow-lg shadow-black/40 border transition-all duration-300 backdrop-blur-xl flex items-center justify-center
          ${(isTriggered || isRefreshing)
            ? 'bg-primary/30 border-primary/50 shadow-primary/25 scale-110' 
            : 'bg-zinc-900/85 border-white/10'
          }
        `}>
          {/* Breathing glow effect when refreshing or triggered */}
          {(isRefreshing || isTriggered) && (
            <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping opacity-60 pointer-events-none" />
          )}
          
          <motion.div
            style={{ rotate: isRefreshing ? undefined : rotate }}
            animate={isRefreshing ? { rotate: 360 } : { scale: (isTriggered || isRefreshing) ? 1.05 : 1 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { type: "spring", stiffness: 300 }}
          >
            <RefreshCw className={`w-5 h-5 transition-colors duration-300 ${(isTriggered || isRefreshing) ? 'text-primary' : 'text-neutral-300'}`} />
          </motion.div>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: pullY }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
