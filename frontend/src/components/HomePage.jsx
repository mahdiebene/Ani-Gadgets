import { useState, useEffect } from 'react';
import CategorySection from './CategorySection';
import { fetchProducts, fetchCategories, fetchAnimeNames } from '../utils/api';

// Category priority for sorting
const CATEGORY_PRIORITY = {
  'Figures': 1,
  'Clothing': 2,
  'T-Shirts': 2,
  'Accessories': 3,
  'Posters': 4,
  'Collectibles': 5,
  'Keychains': 6,
  'Stickers': 7,
  'Bags': 8,
  'Phone Cases': 9,
  'Home Decor': 10,
  'Toys': 11,
};

// Popular anime to feature
const FEATURED_ANIME = [
  'Demon Slayer',
  'Naruto',
  'One Piece',
  'Attack on Titan',
  'Jujutsu Kaisen',
  'Dragon Ball',
  'My Hero Academia',
  'Spy x Family',
];

function HomePage({ onViewCategory, onViewAnime }) {
  const [loading, setLoading] = useState(true);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [categoryProducts, setCategoryProducts] = useState({});
  const [animeProducts, setAnimeProducts] = useState({});
  const [categories, setCategories] = useState([]);
  const [animeNames, setAnimeNames] = useState([]);

  useEffect(() => {
    loadHomePageData();
  }, []);

  async function loadHomePageData() {
    setLoading(true);
    
    try {
      // Fetch metadata first
      const [categoriesData, animeData] = await Promise.all([
        fetchCategories(),
        fetchAnimeNames()
      ]);
      
      setCategories(categoriesData);
      setAnimeNames(animeData);

      // Fetch trending products (top scored)
      const trendingResult = await fetchProducts({
        sortBy: 'intelligent_score',
        sortOrder: 'desc',
        limit: 15
      });
      setTrendingProducts(trendingResult.products || []);

      // Fetch products for each category (top 10 each)
      const categoryPromises = categoriesData.slice(0, 8).map(async (category) => {
        try {
          const result = await fetchProducts({
            category,
            sortBy: 'intelligent_score',
            sortOrder: 'desc',
            limit: 10
          });
          return { category, products: result.products || [] };
        } catch {
          return { category, products: [] };
        }
      });

      // Fetch products for featured anime
      const availableAnime = FEATURED_ANIME.filter(animeName => 
        animeData.some(name => name.toLowerCase().includes(animeName.toLowerCase()))
      ).slice(0, 4);

      const animePromises = availableAnime.map(async (animeName) => {
        try {
          const matchingAnime = animeData.find(name => 
            name.toLowerCase().includes(animeName.toLowerCase())
          );
          if (!matchingAnime) return { anime: animeName, products: [] };
          
          const result = await fetchProducts({
            anime: matchingAnime,
            sortBy: 'intelligent_score',
            sortOrder: 'desc',
            limit: 10
          });
          return { anime: animeName, products: result.products || [] };
        } catch {
          return { anime: animeName, products: [] };
        }
      });

      const [categoryResults, animeResults] = await Promise.all([
        Promise.all(categoryPromises),
        Promise.all(animePromises)
      ]);

      // Process results
      const catProducts = {};
      categoryResults.forEach(({ category, products }) => {
        if (products.length > 0) {
          catProducts[category] = products;
        }
      });
      setCategoryProducts(catProducts);

      const aniProducts = {};
      animeResults.forEach(({ anime, products }) => {
        if (products.length > 0) {
          aniProducts[anime] = { products };
        }
      });
      setAnimeProducts(aniProducts);

    } catch (error) {
      console.error('Error loading home page:', error);
    } finally {
      setLoading(false);
    }
  }

  // Sort categories by priority
  const sortedCategories = Object.keys(categoryProducts).sort((a, b) => {
    const priorityA = CATEGORY_PRIORITY[a] || 99;
    const priorityB = CATEGORY_PRIORITY[b] || 99;
    return priorityA - priorityB;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {/* Trending Section */}
      <CategorySection
        title="Trending Now"
        products={trendingProducts}
        loading={loading}
        onViewAll={() => onViewCategory('All', 'trending_score')}
      />

      {/* Category Sections */}
      {sortedCategories.map((category) => (
        <CategorySection
          key={category}
          title={category}
          products={categoryProducts[category]}
          loading={loading}
          onViewAll={() => onViewCategory(category)}
        />
      ))}

      {/* Anime Sections */}
      {Object.entries(animeProducts).map(([animeName, data]) => (
        <CategorySection
          key={animeName}
          title={animeName}
          products={data.products}
          loading={loading}
          onViewAll={() => onViewAnime(animeName)}
        />
      ))}

      {/* Empty State */}
      {!loading && trendingProducts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-3 rounded bg-[var(--color-bg-tertiary)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            No products yet
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Check back soon for anime merchandise.
          </p>
        </div>
      )}
    </div>
  );
}

export default HomePage;
