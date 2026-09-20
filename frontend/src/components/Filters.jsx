import { useState, useEffect } from 'react';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { fetchCategories, fetchAnimeNames, fetchSources } from '../utils/api';
import { sourceLabel } from '../utils/listings';

const SORT_OPTIONS = [
  { value: 'intelligent_score', label: 'Demand Score' },
  { value: 'trending_score', label: 'Trending' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'reviews_count', label: 'Most Reviewed' },
  { value: 'scraped_at', label: 'Newest' },
];

const PRICE_RANGES = [
  { label: 'All Prices', min: '', max: '' },
  { label: 'Under ৳500', min: '', max: '500' },
  { label: '৳500 - ৳1,000', min: '500', max: '1000' },
  { label: '৳1,000 - ৳3,000', min: '1000', max: '3000' },
  { label: 'Over ৳3,000', min: '3000', max: '' },
];

function Filters({ filters, onFilterChange, totalItems = 0 }) {
  const [categories, setCategories] = useState([]);
  const [animeNames, setAnimeNames] = useState([]);
  const [sources, setSources] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState('All Prices');

  useEffect(() => {
    loadFiltersData();
  }, []);

  useEffect(() => {
    if (!filters.minPrice && !filters.maxPrice) {
      setSelectedPriceRange('All Prices');
    }
  }, [filters.minPrice, filters.maxPrice]);

  async function loadFiltersData() {
    try {
      const results = await Promise.allSettled([
        fetchCategories(),
        fetchAnimeNames(),
        fetchSources()
      ]);
      if (results[0].status === 'fulfilled') setCategories(results[0].value);
      if (results[1].status === 'fulfilled') setAnimeNames(results[1].value);
      if (results[2].status === 'fulfilled') setSources(results[2].value);
    } catch (err) {
      console.error('Error loading filter data:', err);
    }
  }

  function handleSortChange(e) {
    const value = e.target.value;
    if (value === 'price_asc') {
      onFilterChange({ sortBy: 'price', sortOrder: 'asc' });
    } else if (value === 'price_desc') {
      onFilterChange({ sortBy: 'price', sortOrder: 'desc' });
    } else {
      onFilterChange({ sortBy: value, sortOrder: 'desc' });
    }
  }

  function handlePriceChange(e) {
    const selected = PRICE_RANGES.find(p => p.label === e.target.value);
    if (selected) {
      setSelectedPriceRange(selected.label);
      onFilterChange({ minPrice: selected.min, maxPrice: selected.max });
    }
  }

  function clearFilters() {
    setSelectedPriceRange('All Prices');
    onFilterChange({
      search: '',
      category: '',
      anime: '',
      source: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'intelligent_score',
      sortOrder: 'desc'
    });
  }

  const activeFilters = [];
  if (filters.search) activeFilters.push({ key: 'search', label: `"${filters.search}"`, value: filters.search });
  if (filters.anime) activeFilters.push({ key: 'anime', label: filters.anime, value: filters.anime });
  if (filters.category) activeFilters.push({ key: 'category', label: filters.category, value: filters.category });
  if (filters.source) activeFilters.push({ key: 'source', label: sourceLabel(filters.source), value: filters.source });
  if (filters.minPrice || filters.maxPrice) activeFilters.push({ key: 'price', label: selectedPriceRange, value: selectedPriceRange });

  const hasActiveFilters = activeFilters.length > 0;

  const selectStyles = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundPosition: 'right 8px center',
    backgroundRepeat: 'no-repeat'
  };

  const removeFilter = (key) => {
    if (key === 'search') onFilterChange({ search: '' });
    if (key === 'anime') onFilterChange({ anime: '' });
    if (key === 'category') onFilterChange({ category: '' });
    if (key === 'price') {
      setSelectedPriceRange('All Prices');
      onFilterChange({ minPrice: '', maxPrice: '' });
    }
  };

  const FilterSelects = () => (
    <div className="flex flex-wrap items-center gap-3">
      {/* Anime */}
      <select
        value={filters.anime || ''}
        onChange={(e) => onFilterChange({ anime: e.target.value })}
        className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md py-2 pl-3 pr-8 
                   text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]
                   appearance-none cursor-pointer min-w-[140px] focus-ring"
        style={selectStyles}
      >
        <option value="">All Anime</option>
        {animeNames.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category}
        onChange={(e) => onFilterChange({ category: e.target.value })}
        className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md py-2 pl-3 pr-8 
                   text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]
                   appearance-none cursor-pointer min-w-[140px] focus-ring"
        style={selectStyles}
      >
        <option value="">All Categories</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* Price */}
      <select
        value={selectedPriceRange}
        onChange={handlePriceChange}
        className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md py-2 pl-3 pr-8 
                   text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]
                   appearance-none cursor-pointer min-w-[140px] focus-ring"
        style={selectStyles}
      >
        {PRICE_RANGES.map(range => (
          <option key={range.label} value={range.label}>{range.label}</option>
        ))}
      </select>

      {/* Source */}
      <select
        aria-label="Source"
        value={filters.source}
        onChange={e => onFilterChange({ source: e.target.value })}
        className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md py-2 pl-3 pr-8 text-sm text-[var(--color-text-primary)] focus-ring"
        style={selectStyles}
      >
        <option value="">All Sources</option>
        {sources.map(source => <option key={source} value={source}>{sourceLabel(source)}</option>)}
      </select>

      {/* Sort */}
      <select
        value={filters.sortBy === 'price' 
          ? (filters.sortOrder === 'asc' ? 'price_asc' : 'price_desc')
          : filters.sortBy
        }
        onChange={handleSortChange}
        className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md py-2 pl-3 pr-8 
                   text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]
                   appearance-none cursor-pointer min-w-[150px] focus-ring"
        style={selectStyles}
      >
        {SORT_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="mb-6">
      {/* Filter controls row */}
      <div className="flex items-center justify-between mb-4">
        {/* Desktop Filters */}
        <div className="hidden md:block">
          <FilterSelects />
        </div>

        {/* Mobile filter button */}
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="md:hidden flex items-center gap-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] 
                   border border-[var(--color-border)] rounded-md px-3 py-2 focus-ring"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-[var(--color-accent)] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilters.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Mobile Filters */}
      {showMobileFilters && (
        <div className="md:hidden p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg mb-4">
          <FilterSelects />
        </div>
      )}

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Active:</span>
          {activeFilters.map(filter => (
            <button
              key={filter.key}
              onClick={() => removeFilter(filter.key)}
              className="chip group"
            >
              <span>{filter.label}</span>
              <X className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]" />
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default Filters;
