import { useState } from 'react';
import { ExternalLink, Star, Heart } from 'lucide-react';
import ProductImage from './ProductImage';
import { formatPrice, truncateText, calculateDiscount } from '../utils/helpers';

function ProductCard({ product, compact = false }) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const discount = calculateDiscount(product.original_price, product.price);
  const score = product.intelligent_score || product.trending_score || 0;
  
  const getScoreStyle = (score) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 70) return 'bg-orange-500';
    if (score >= 60) return 'bg-[var(--color-accent)]';
    return 'bg-[var(--color-text-muted)]';
  };
  
  return (
    <article className={`group bg-[var(--color-bg-secondary)] border border-[var(--color-border)] 
                       rounded overflow-hidden hover:border-[var(--color-accent)]/50 
                       transition-all duration-150 flex flex-col h-full`}>
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-[var(--color-bg-tertiary)]">
        <ProductImage 
          src={product.image_url} 
          alt={product.name}
          className="aspect-square group-hover:scale-105 transition-transform duration-200"
        />
        
        {/* Score Badge */}
        <div className={`absolute top-2 right-2 ${getScoreStyle(score)} 
                        text-white text-xs font-semibold px-1.5 py-0.5 rounded-sm`}>
          {Math.round(score)}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsWishlisted(!isWishlisted);
          }}
          className={`absolute top-2 left-2 p-1 rounded-sm transition-all duration-150
                     ${isWishlisted 
                       ? 'bg-red-500 text-white' 
                       : 'bg-black/40 text-white/80 hover:bg-black/60 opacity-0 group-hover:opacity-100'
                     }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Discount Badge */}
        {discount > 0 && (
          <div className="absolute bottom-2 left-2 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-sm">
            -{discount}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col flex-grow ${compact ? 'p-2.5' : 'p-3'}`}>
        {/* Anime Tag */}
        {product.anime_name && (
          <span className="text-[var(--color-accent)] text-[10px] font-medium mb-1 truncate uppercase tracking-wide">
            {product.anime_name}
          </span>
        )}
        
        {/* Name */}
        <h3 className={`text-[var(--color-text-primary)] font-medium leading-snug line-clamp-2 
                       ${compact ? 'text-xs mb-1.5 min-h-[2rem]' : 'text-sm mb-2 min-h-[2.5rem]'}`} 
            title={product.name}>
          {truncateText(product.name, compact ? 40 : 55)}
        </h3>

        {/* Rating */}
        {!compact && (product.rating ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-xs mb-2">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[var(--color-text-secondary)]">
              {Number(product.rating).toFixed(1)}
            </span>
          </div>
        )}

        {/* Price & CTA */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className={`font-bold text-[var(--color-text-primary)] ${compact ? 'text-sm' : 'text-base'}`}>
              {formatPrice(product.price)}
            </span>
            {product.original_price > product.price && (
              <span className="text-[10px] text-[var(--color-text-muted)] line-through">
                {formatPrice(product.original_price)}
              </span>
            )}
          </div>

          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 w-full 
                     bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]
                     text-white font-medium rounded-sm transition-colors
                     ${compact ? 'text-xs py-1.5' : 'text-sm py-2'}`}
          >
            <ExternalLink className="w-3 h-3" />
            View on Daraz
          </a>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
