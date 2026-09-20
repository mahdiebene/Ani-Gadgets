import { useSyncExternalStore } from 'react';
import { ExternalLink, Star, Heart } from 'lucide-react';
import ProductImage from './ProductImage';
import { formatPrice, truncateText, calculateDiscount, formatRelativeTime } from '../utils/helpers';
import { sourceLabel, purchaseLink, listingKey } from '../utils/listings';
import { wishlistStore } from '../utils/wishlist';

function ProductCard({ product, compact = false }) {
  const saved = useSyncExternalStore(wishlistStore.subscribe, wishlistStore.getSnapshot, wishlistStore.getServerSnapshot);
  const key = listingKey(product);
  const isWishlisted = saved.includes(key);
  const link = purchaseLink(product);
  const observedAt = product.last_seen_at || product.scraped_at;
  const discount = calculateDiscount(product.original_price, product.price);
  const score = product.intelligent_score ?? product.trending_score;
  
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
        {score != null && <div title="Demand score, not an authenticity or quality rating" className={`absolute top-2 right-2 ${getScoreStyle(score)}
                        text-white text-xs font-semibold px-1.5 py-0.5 rounded-sm`}>
          Demand {Math.round(score)}
        </div>}

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            wishlistStore.toggle(key);
          }}
          disabled={!key}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={isWishlisted}
          title="Saved on this browser; unavailable storage means session-only saving"
          className={`absolute top-2 left-2 p-1 rounded-sm transition-all duration-150
                     ${isWishlisted 
                       ? 'bg-red-500 text-white' 
                        : 'bg-black/40 text-white/80 hover:bg-black/60'
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

        <div className="text-[10px] text-[var(--color-text-muted)] mb-2 space-y-1">
          <p>{sourceLabel(product.source)}{product.seller_name ? ` · ${product.seller_name}` : ''}</p>
          <p>Last seen: {formatRelativeTime(observedAt)}</p>
          <p>Authenticity not reviewed</p>
        </div>

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
            {product.price != null && product.original_price > product.price && (
              <span className="text-[10px] text-[var(--color-text-muted)] line-through">
                {formatPrice(product.original_price)}
              </span>
            )}
          </div>

          <p className="text-[10px] text-[var(--color-text-muted)] mb-2">Listed price; delivery and final total unconfirmed.</p>

          {link ? <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 w-full 
                     bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]
                     text-white font-medium rounded-sm transition-colors
                     ${compact ? 'text-xs py-1.5' : 'text-sm py-2'}`}
          >
            <ExternalLink className="w-3 h-3" />
            {link.label}
          </a> : <p className="text-xs text-[var(--color-text-muted)]">Purchase link unavailable</p>}
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
