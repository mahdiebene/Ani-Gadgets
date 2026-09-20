import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Filters from './Filters';
import ProductGrid from './ProductGrid';
import { fetchProducts } from '../utils/api';
import { createBrowseFilters } from '../utils/browse';

const ITEMS_PER_PAGE = 20;

function BrowsePage({ initialCategory = '', initialAnime = '', initialSort = 'intelligent_score', initialSearch = '', onBack }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [filters, setFilters] = useState(() => createBrowseFilters({
    search: initialSearch,
    category: initialCategory,
    anime: initialAnime,
    sortBy: initialSort
  }));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    async function loadProducts() {
      try {
        const result = await fetchProducts({
          ...filters, page: currentPage, limit: ITEMS_PER_PAGE
        }, { signal: controller.signal });
        if (!active) return;
        setProducts(result.products);
        setTotalItems(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        if (!active || err.name === 'AbortError') return;
        console.error('Error loading products:', err);
        setProducts([]);
        setTotalItems(0);
        setTotalPages(0);
        setError('Failed to load products. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProducts();
    return () => { active = false; controller.abort(); };
  }, [filters, currentPage]);

  function handleFilterChange(newFilters) {
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, ...newFilters }));
  }

  function handlePageChange(page) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Determine page title
  let pageTitle = 'All Products';
  if (filters.search) {
    pageTitle = `Search: ${filters.search}`;
  } else if (filters.anime) {
    pageTitle = filters.anime;
  } else if (filters.category) {
    pageTitle = filters.category;
  } else if (filters.sortBy === 'trending_score') {
    pageTitle = 'Trending Products';
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          aria-label="Back to home"
          className="flex items-center justify-center w-10 h-10 rounded-lg
                     bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)]
                     border border-[var(--color-border)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {pageTitle}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {totalItems} products found
          </p>
        </div>
      </div>

      {/* Filters */}
      <Filters 
        filters={filters} 
        onFilterChange={handleFilterChange}
        totalItems={totalItems}
      />
      
      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}
      
      {/* Product Grid */}
      <ProductGrid 
        products={products} 
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

export default BrowsePage;
