function SkeletonCard() {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded overflow-hidden">
      {/* Image skeleton */}
      <div className="aspect-square skeleton" />
      
      {/* Content skeleton */}
      <div className="p-2.5 space-y-2">
        {/* Anime tag */}
        <div className="skeleton h-2.5 w-14 rounded-sm" />
        
        {/* Title */}
        <div className="space-y-1">
          <div className="skeleton h-3 w-full rounded-sm" />
          <div className="skeleton h-3 w-3/4 rounded-sm" />
        </div>
        
        {/* Price */}
        <div className="skeleton h-4 w-20 rounded-sm" />
        
        {/* Button */}
        <div className="skeleton h-7 w-full rounded-sm" />
      </div>
    </div>
  );
}

export default SkeletonCard;
