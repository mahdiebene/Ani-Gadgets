/**
 * Trending Score Calculator
 * 
 * Calculates a 0-100 score for products based on:
 * - Anime Popularity (0-50 points)
 * - Product Signals (0-35 points)  
 * - Freshness (0-15 points)
 * 
 * Products scoring 60+ are considered "trending"
 */

/**
 * Calculate trending score for a product
 * @param {Object} product - Product data
 * @param {Object} anime - Associated anime data
 * @returns {number} Score 0-100
 */
function calculateTrendingScore(product, anime) {
  let score = 0;

  // ===== COMPONENT 1: Anime Popularity (0-50 points) =====
  if (anime) {
    // MAL Score contribution (0-30 points)
    // MAL scores range from 1-10, most good anime score 7-9
    const malScore = anime.score || 0;
    const normalizedMAL = Math.min((malScore / 10) * 30, 30);
    
    // Member count contribution (0-20 points)
    // Popular anime have 500k-2M+ members
    const members = anime.members || 0;
    const memberScore = Math.min((members / 1000000) * 20, 20);
    
    score += normalizedMAL + memberScore;
  } else {
    // No anime data - give base score for being anime-related
    score += 15;
  }

  // ===== COMPONENT 2: Product Signals (0-35 points) =====
  
  // Review count (0-15 points)
  // Products with 50+ reviews are popular
  const reviews = product.reviews_count || 0;
  const reviewScore = Math.min((reviews / 50) * 15, 15);
  
  // Rating score (0-12 points)
  // Good products have 4+ stars
  const rating = product.rating || 0;
  const ratingScore = (rating / 5) * 12;
  
  // Discount bonus (0-5 points)
  // Discounted items attract more buyers
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountScore = hasDiscount ? 5 : 0;
  
  // Price reasonability bonus (0-3 points)
  // Items in 500-5000 BDT range are most purchased
  const price = product.price || 0;
  const priceScore = (price >= 500 && price <= 5000) ? 3 : 
                     (price > 0 && price < 500) ? 2 :
                     (price > 5000 && price <= 10000) ? 1 : 0;
  
  score += reviewScore + ratingScore + discountScore + priceScore;

  // ===== COMPONENT 3: Freshness (0-15 points) =====
  const scrapedAt = new Date(product.scraped_at);
  const hoursSinceScraped = (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60);
  
  const freshnessScore = hoursSinceScraped < 24 ? 15 :
                         hoursSinceScraped < 48 ? 12 :
                         hoursSinceScraped < 72 ? 8 :
                         hoursSinceScraped < 168 ? 4 : 0;
  
  score += freshnessScore;

  // Round and clamp to 0-100
  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Get score breakdown for display
 */
function getScoreBreakdown(product, anime) {
  const breakdown = {
    animePopularity: {
      malScore: 0,
      memberScore: 0,
      total: 0,
      maxPossible: 50
    },
    productSignals: {
      reviewScore: 0,
      ratingScore: 0,
      discountScore: 0,
      priceScore: 0,
      total: 0,
      maxPossible: 35
    },
    freshness: {
      score: 0,
      maxPossible: 15
    },
    total: 0
  };

  // Calculate anime popularity
  if (anime) {
    breakdown.animePopularity.malScore = Math.min((anime.score / 10) * 30, 30);
    breakdown.animePopularity.memberScore = Math.min((anime.members / 1000000) * 20, 20);
  } else {
    breakdown.animePopularity.malScore = 15;
  }
  breakdown.animePopularity.total = breakdown.animePopularity.malScore + breakdown.animePopularity.memberScore;

  // Calculate product signals
  breakdown.productSignals.reviewScore = Math.min((product.reviews_count / 50) * 15, 15);
  breakdown.productSignals.ratingScore = (product.rating / 5) * 12;
  breakdown.productSignals.discountScore = (product.original_price > product.price) ? 5 : 0;
  breakdown.productSignals.priceScore = (product.price >= 500 && product.price <= 5000) ? 3 : 
                                        (product.price > 0 && product.price < 500) ? 2 : 0;
  breakdown.productSignals.total = breakdown.productSignals.reviewScore + 
                                   breakdown.productSignals.ratingScore + 
                                   breakdown.productSignals.discountScore +
                                   breakdown.productSignals.priceScore;

  // Calculate freshness
  const hoursSinceScraped = (Date.now() - new Date(product.scraped_at).getTime()) / (1000 * 60 * 60);
  breakdown.freshness.score = hoursSinceScraped < 24 ? 15 :
                              hoursSinceScraped < 48 ? 12 :
                              hoursSinceScraped < 72 ? 8 : 0;

  // Total
  breakdown.total = Math.round(
    breakdown.animePopularity.total + 
    breakdown.productSignals.total + 
    breakdown.freshness.score
  );

  return breakdown;
}

/**
 * Recalculate scores for all products
 */
async function recalculateAllScores(supabase) {
  console.log('🔄 Recalculating all product scores...');

  // Get all products with anime data
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      *,
      trending_anime (*)
    `);

  if (productsError) {
    console.error('Error fetching products:', productsError.message);
    return { success: false, error: productsError.message };
  }

  let updated = 0;
  for (const product of products) {
    const newScore = calculateTrendingScore(product, product.trending_anime);
    
    if (newScore !== product.trending_score) {
      const { error } = await supabase
        .from('products')
        .update({ trending_score: newScore })
        .eq('id', product.id);

      if (!error) updated++;
    }
  }

  console.log(`✅ Updated ${updated} product scores`);
  return { success: true, updated };
}

module.exports = {
  calculateTrendingScore,
  getScoreBreakdown,
  recalculateAllScores
};
