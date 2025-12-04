import CategoryPills from './CategoryPills';

function Hero({ categories = [], activeCategory = 'All', onCategorySelect, stats }) {
  return (
    <section className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Title Row */}
        <div className="text-center mb-5">
          <p className="text-[var(--color-accent)] text-xs font-medium mb-2 uppercase tracking-wide">
            Bangladesh's Anime Merch Hub
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-1">
            Discover Anime Merchandise
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm">
            {stats?.trendingProducts || 0}+ products curated from top stores
          </p>
        </div>

        {/* Category Pills */}
        <CategoryPills 
          categories={categories}
          activeCategory={activeCategory}
          onSelect={onCategorySelect}
        />
      </div>
    </section>
  );
}

export default Hero;
