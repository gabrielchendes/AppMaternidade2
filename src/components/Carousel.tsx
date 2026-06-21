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
    <div className="relative group/carousel mb-4 sm:mb-8">
      <div className="flex flex-col px-6 md:px-16 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">
          {title}
        </h2>
      </div>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-black/40 opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:flex items-center justify-center hover:bg-black/60"
        >
          <ChevronLeft size={32} />
        </button>

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-16 pb-4 snap-x snap-mandatory"
        >
          {children}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-black/40 opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:flex items-center justify-center hover:bg-black/60"
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
});

export default Carousel;
