import { ReactNode, useRef, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps {
  title: string;
  children: ReactNode;
}

const Carousel = memo(({ title, children }: CarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - (clientWidth * 0.8) : scrollLeft + (clientWidth * 0.8);
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/carousel mb-6 sm:mb-10">
      <div className="flex items-center justify-between px-4 sm:px-8 md:px-16 mb-3 sm:mb-4">
        <h2 className="text-base sm:text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          {title}
        </h2>
      </div>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full glass border border-white/10 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:flex items-center justify-center hover:bg-white/10 shadow-xl active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          className="flex gap-3.5 sm:gap-5 overflow-x-auto scrollbar-hide px-4 sm:px-8 md:px-16 pb-3 snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-8 md:scroll-pl-16 touch-pan-x touch-pan-y overscroll-x-contain"
        >
          {children}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full glass border border-white/10 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:flex items-center justify-center hover:bg-white/10 shadow-xl active:scale-95"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
});

export default Carousel;
