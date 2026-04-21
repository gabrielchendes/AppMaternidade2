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
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/carousel mb-12">
      <h2 className="text-2xl font-black mb-6 px-12 text-gray-200 uppercase tracking-tighter italic">
        {title}
      </h2>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-black/40 opacity-0 group-hover/carousel:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/60"
        >
          <ChevronLeft size={32} />
        </button>

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-12 pb-4 snap-x snap-mandatory"
        >
          {children}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-black/40 opacity-0 group-hover/carousel:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/60"
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
});

export default Carousel;
