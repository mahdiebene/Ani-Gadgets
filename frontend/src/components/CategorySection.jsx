import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';
import SkeletonCard from './SkeletonCard';

function CategorySection({ 
  title, 
  products = [], 
  loading = false, 
  onViewAll,
}) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction) => {
    const container = scrollRef.current;
    if (!container) return;
    
    const scrollAmount = container.clientWidth * 0.8;
    const newScrollLeft = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    
    setShowLeftArrow(container.scrollLeft > 20);
    setShowRightArrow(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 20
    );
  };

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5">
            {products.length}
          </span>
        </div>
        
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            See all →
          </button>
        )}
      </div>

      {/* Scrollable Container */}
      <div className="relative group/section">
        {/* Left Arrow - hidden on mobile */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 
                       bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                       items-center justify-center
                       opacity-0 group-hover/section:opacity-100 transition-opacity
                       hover:border-[var(--color-accent)]"
          >
            <ChevronLeft className="w-4 h-4 text-[var(--color-text-primary)]" />
          </button>
        )}

        {/* Right Arrow - hidden on mobile */}
        {showRightArrow && !loading && products.length > 4 && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 
                       bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                       items-center justify-center
                       opacity-0 group-hover/section:opacity-100 transition-opacity
                       hover:border-[var(--color-accent)]"
          >
            <ChevronRight className="w-4 h-4 text-[var(--color-text-primary)]" />
          </button>
        )}

        {/* Products Row */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[180px]">
                <SkeletonCard />
              </div>
            ))
          ) : (
            products.map((product, index) => (
              <div 
                key={product.id || `product-${index}`} 
                className="flex-shrink-0 w-[170px] sm:w-[185px]"
              >
                <ProductCard product={product} compact />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default CategorySection;
