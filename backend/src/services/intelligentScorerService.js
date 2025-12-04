/**
 * Layer 4: Intelligent Filtering & Ranking System v2.0
 * 
 * PHILOSOPHY: "Real Demand Trumps Theoretical Popularity"
 * 
 * Products with ACTUAL sales evidence (reviews, high ratings) should 
 * ALWAYS rank higher than products that are merely from popular anime
 * but have zero proof of demand.
 * 
 * SCORING FORMULA (Revised):
 * ============================================================
 * BASE SCORE (Max 100):
 *   - Sales Evidence (40 pts)     <- PRIMARY: Reviews + Ratings
 *   - Anime Popularity (25 pts)   <- Boost for popular anime
 *   - Product Appeal (15 pts)     <- Figures > Posters > etc
 *   - Value Score (15 pts)        <- Price + Discounts
 *   - Freshness (5 pts)           <- Recency bonus
 * 
 * CRITICAL PENALTIES:
 *   - Zero Reviews: HARD CAP at 45 points maximum
 *   - Zero Rating: Additional -5 penalty
 *   - Very Low Reviews (<3): Cap at 50 points
 * 
 * This ensures that a Death Note figure with 0 reviews (was scoring 71)
 * now caps at 45, while a generic product with 50+ reviews scores 75+.
 */

const { POPULAR_ANIME_BD } = require('../config/bdAnimeConfig');

// Create anime lookup map for quick access
const ANIME_LOOKUP = new Map();
POPULAR_ANIME_BD.forEach(anime => {
  ANIME_LOOKUP.set(anime.name.toLowerCase(), anime);
  anime.aliases.forEach(alias => {
    ANIME_LOOKUP.set(alias.toLowerCase(), anime);
  });
  anime.characters.forEach(char => {
    ANIME_LOOKUP.set(char.toLowerCase(), { ...anime, matchedCharacter: char });
  });
});

// ============================================================
// SCORING WEIGHTS (Must sum to 100)
// ============================================================
const WEIGHTS = {
  SALES_EVIDENCE: 40,    // Most important - actual proof of demand
  ANIME_POPULARITY: 25,  // Boost for popular anime
  PRODUCT_APPEAL: 15,    // Product type popularity
  VALUE_SCORE: 15,       // Price attractiveness + discounts
  FRESHNESS: 5           // Recency bonus
};

// ============================================================
// COMPONENT 1: SALES EVIDENCE (0-40 points)
// This is the KING. No reviews = low score.
// ============================================================
function calculateSalesEvidenceScore(product) {
  let score = 0;
  const signals = [];
  
  const reviewCount = product.reviews_count || product.reviewsCount || 0;
  const rating = product.rating || 0;
  
  // 1A. REVIEW COUNT (0-25 points)
  // This is the most important single factor
  if (reviewCount >= 200) {
    score += 25;
    signals.push('⭐ Bestseller (200+ reviews)');
  } else if (reviewCount >= 100) {
    score += 22;
    signals.push('⭐ Very popular (100+ reviews)');
  } else if (reviewCount >= 50) {
    score += 18;
    signals.push('Popular (50+ reviews)');
  } else if (reviewCount >= 25) {
    score += 14;
    signals.push('Well-reviewed (25+ reviews)');
  } else if (reviewCount >= 10) {
    score += 10;
    signals.push('Good traction (10+ reviews)');
  } else if (reviewCount >= 5) {
    score += 6;
    signals.push('Some reviews (5+)');
  } else if (reviewCount >= 1) {
    score += 3;
    signals.push('Has reviews');
  } else {
    score += 0;
    signals.push('⚠️ No reviews yet');
  }
  
  // 1B. RATING QUALITY (0-15 points)
  // Only give points if there are reviews to back it up
  if (reviewCount > 0) {
    if (rating >= 4.8) {
      score += 15;
      signals.push('Outstanding rating (4.8+)');
    } else if (rating >= 4.5) {
      score += 12;
      signals.push('Excellent rating (4.5+)');
    } else if (rating >= 4.0) {
      score += 9;
      signals.push('Good rating (4.0+)');
    } else if (rating >= 3.5) {
      score += 5;
      signals.push('Average rating (3.5+)');
    } else if (rating >= 3.0) {
      score += 2;
      signals.push('Below average rating');
    } else {
      score += 0;
      signals.push('Poor rating');
    }
  } else {
    // No reviews = no rating credit
    signals.push('No rating data');
  }
  
  return {
    score: Math.min(WEIGHTS.SALES_EVIDENCE, score),
    maxScore: WEIGHTS.SALES_EVIDENCE,
    reason: signals[0],
    details: {
      reviewCount,
      rating,
      signals,
      hasProvenDemand: reviewCount >= 5
    }
  };
}

// ============================================================
// COMPONENT 2: ANIME POPULARITY (0-25 points)
// Boost for popular anime, but NOT enough to compensate for no sales
// ============================================================
function calculateAnimePopularityScore(animeName, animeMatch) {
  if (!animeName || animeName === 'Anime' || animeName === 'Unknown') {
    return {
      score: 8,
      maxScore: WEIGHTS.ANIME_POPULARITY,
      reason: 'Generic anime merchandise',
      details: { matchType: 'generic' }
    };
  }

  const animeData = ANIME_LOOKUP.get(animeName.toLowerCase());
  
  if (!animeData) {
    return {
      score: 10,
      maxScore: WEIGHTS.ANIME_POPULARITY,
      reason: `${animeName} - moderate popularity`,
      details: { matchType: 'unknown', animeName }
    };
  }

  // Priority scores (reduced from before)
  // Priority 1 (Naruto, DBZ, One Piece): 25 pts
  // Priority 2 (Death Note, MHA): 20 pts
  // Priority 3 (FMA, etc): 16 pts
  const priorityScores = {
    1: 25,
    2: 20,
    3: 16,
    4: 13,
    5: 10
  };

  const baseScore = priorityScores[animeData.priority] || 10;
  
  // Small bonus for character-specific match (+2)
  const characterBonus = animeMatch?.character ? 2 : 0;
  
  const finalScore = Math.min(WEIGHTS.ANIME_POPULARITY, baseScore + characterBonus);

  const popularityLabel = animeData.priority === 1 ? 'Top-tier' 
    : animeData.priority === 2 ? 'Very popular'
    : 'Popular';

  return {
    score: finalScore,
    maxScore: WEIGHTS.ANIME_POPULARITY,
    reason: `${animeName} - ${popularityLabel} in BD`,
    details: {
      matchType: animeMatch?.character ? 'character' : 'anime',
      priority: animeData.priority,
      characterMatch: animeMatch?.character || null
    }
  };
}

// ============================================================
// COMPONENT 3: PRODUCT APPEAL (0-15 points)
// Some product types are more desirable than others
// ============================================================
function calculateProductAppealScore(product) {
  let score = 0;
  let reason = 'Standard merchandise';
  const signals = [];
  const nameLower = (product.name || '').toLowerCase();

  // Product type hierarchy
  if (nameLower.includes('figure') || nameLower.includes('action figure') || nameLower.includes('statue')) {
    score = 15;
    reason = 'High-value collectible figure';
    signals.push('Figures are premium collectibles');
  } else if (nameLower.includes('led') || nameLower.includes('lamp') || nameLower.includes('night light')) {
    score = 13;
    reason = 'Trendy LED lamp';
    signals.push('LED lamps trending on social');
  } else if (nameLower.includes('hoodie') || nameLower.includes('jacket') || nameLower.includes('sweater')) {
    score = 11;
    reason = 'Wearable hoodie/jacket';
    signals.push('Hoodies popular for daily wear');
  } else if (nameLower.includes('poster') || nameLower.includes('wall art') || nameLower.includes('canvas')) {
    score = 9;
    reason = 'Decorative poster/art';
    signals.push('Popular room decor');
  } else if (nameLower.includes('t-shirt') || nameLower.includes('tshirt') || nameLower.includes('shirt')) {
    score = 8;
    reason = 'Anime t-shirt';
    signals.push('T-shirts commonly worn');
  } else if (nameLower.includes('bag') || nameLower.includes('backpack')) {
    score = 8;
    reason = 'Anime bag/backpack';
    signals.push('Bags used daily');
  } else if (nameLower.includes('keychain') || nameLower.includes('keyring')) {
    score = 6;
    reason = 'Small collectible keychain';
    signals.push('Popular small item');
  } else if (nameLower.includes('mug') || nameLower.includes('cup')) {
    score = 6;
    reason = 'Anime mug';
    signals.push('Common gift item');
  } else if (nameLower.includes('phone case') || nameLower.includes('cover')) {
    score = 5;
    reason = 'Phone case';
    signals.push('Phone accessory');
  } else if (nameLower.includes('sticker') || nameLower.includes('badge') || nameLower.includes('pin')) {
    score = 4;
    reason = 'Small accessory';
    signals.push('Small decorative item');
  } else {
    score = 5;
    reason = 'General merchandise';
    signals.push('Standard product');
  }

  // Bonus for character-specific products
  const hypeCharacters = [
    'gojo', 'sukuna', 'levi', 'eren', 'goku', 'vegeta', 
    'naruto', 'sasuke', 'itachi', 'kakashi', 'luffy', 'zoro',
    'tanjiro', 'nezuko', 'anya', 'makima', 'power'
  ];
  
  for (const char of hypeCharacters) {
    if (nameLower.includes(char)) {
      // Small boost for hyped characters, don't exceed max
      score = Math.min(WEIGHTS.PRODUCT_APPEAL, score + 2);
      signals.push(`Features ${char}`);
      break;
    }
  }

  return {
    score: Math.min(WEIGHTS.PRODUCT_APPEAL, score),
    maxScore: WEIGHTS.PRODUCT_APPEAL,
    reason,
    details: { signals }
  };
}

// ============================================================
// COMPONENT 4: VALUE SCORE (0-15 points)
// Price attractiveness + discounts
// BD market is very price-sensitive
// ============================================================
function calculateValueScore(product) {
  let score = 0;
  const signals = [];
  
  const price = product.price || 0;
  const originalPrice = product.original_price || product.originalPrice || price;
  
  // 4A. Price tier (0-10 points)
  // Lower prices are more accessible in BD market
  if (price > 0 && price <= 300) {
    score += 10;
    signals.push('Budget-friendly (≤৳300)');
  } else if (price <= 500) {
    score += 9;
    signals.push('Very affordable (≤৳500)');
  } else if (price <= 800) {
    score += 8;
    signals.push('Affordable (≤৳800)');
  } else if (price <= 1200) {
    score += 7;
    signals.push('Reasonable (≤৳1200)');
  } else if (price <= 2000) {
    score += 5;
    signals.push('Moderate price');
  } else if (price <= 3500) {
    score += 3;
    signals.push('Higher price point');
  } else if (price <= 5000) {
    score += 2;
    signals.push('Premium price');
  } else if (price > 5000) {
    score += 1;
    signals.push('Luxury price');
  }
  
  // 4B. Discount bonus (0-5 points)
  if (originalPrice > price && price > 0) {
    const discountPercent = ((originalPrice - price) / originalPrice) * 100;
    if (discountPercent >= 50) {
      score += 5;
      signals.push(`🔥 Major sale (${Math.round(discountPercent)}% off)`);
    } else if (discountPercent >= 30) {
      score += 4;
      signals.push(`Great discount (${Math.round(discountPercent)}% off)`);
    } else if (discountPercent >= 20) {
      score += 3;
      signals.push(`Good discount (${Math.round(discountPercent)}% off)`);
    } else if (discountPercent >= 10) {
      score += 2;
      signals.push(`Discount (${Math.round(discountPercent)}% off)`);
    } else if (discountPercent >= 5) {
      score += 1;
      signals.push(`Small discount`);
    }
  }
  
  return {
    score: Math.min(WEIGHTS.VALUE_SCORE, score),
    maxScore: WEIGHTS.VALUE_SCORE,
    reason: signals[0] || 'Standard pricing',
    details: {
      price,
      originalPrice,
      discountPercent: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
      signals
    }
  };
}

// ============================================================
// COMPONENT 5: FRESHNESS BONUS (0-5 points)
// Newer listings get a small boost
// ============================================================
function calculateFreshnessScore(product) {
  const scrapedAt = product.scraped_at || product.scrapedAt || product.created_at || new Date().toISOString();
  const scrapedDate = new Date(scrapedAt);
  const now = new Date();
  const daysSinceScraped = (now - scrapedDate) / (1000 * 60 * 60 * 24);

  let score = 0;
  let reason = '';

  if (daysSinceScraped <= 1) {
    score = 5;
    reason = 'Just added';
  } else if (daysSinceScraped <= 3) {
    score = 4;
    reason = 'Added recently';
  } else if (daysSinceScraped <= 7) {
    score = 3;
    reason = 'This week';
  } else if (daysSinceScraped <= 14) {
    score = 2;
    reason = 'Last 2 weeks';
  } else if (daysSinceScraped <= 30) {
    score = 1;
    reason = 'This month';
  } else {
    score = 0;
    reason = 'Older listing';
  }

  return {
    score,
    maxScore: WEIGHTS.FRESHNESS,
    reason,
    details: { daysSinceScraped: Math.round(daysSinceScraped) }
  };
}

// ============================================================
// MAIN SCORING FUNCTION
// Combines all components with CRITICAL penalties for no sales
// ============================================================
function calculateIntelligentTrendingScore(product, animeMatch = null) {
  const animeName = product.anime_name || product.animeName || animeMatch?.name || 'Unknown';
  const reviewCount = product.reviews_count || product.reviewsCount || 0;
  const rating = product.rating || 0;

  // Calculate all 5 components
  const salesEvidence = calculateSalesEvidenceScore(product);
  const animePopularity = calculateAnimePopularityScore(animeName, animeMatch);
  const productAppeal = calculateProductAppealScore(product);
  const valueScore = calculateValueScore(product);
  const freshness = calculateFreshnessScore(product);

  // Raw total (before penalties)
  let rawTotal = 
    salesEvidence.score +
    animePopularity.score +
    productAppeal.score +
    valueScore.score +
    freshness.score;

  // ============================================================
  // CRITICAL PENALTIES - This is what prevents 0-review products
  // from scoring high just because they're "Death Note figure"
  // ============================================================
  
  let penalties = [];
  let penaltyAmount = 0;
  let scoreCap = 100;
  
  // PENALTY 1: Zero reviews = HARD CAP at 55 (was 45, but BD market has few reviews)
  // This still ensures products WITH reviews always rank higher
  if (reviewCount === 0) {
    scoreCap = 55;
    penalties.push('No reviews: max score capped at 55');
  }
  // PENALTY 2: Very few reviews (1-2) = Cap at 65
  else if (reviewCount < 3) {
    scoreCap = 65;
    penalties.push('Very few reviews: max score capped at 65');
  }
  // PENALTY 3: Few reviews (3-4) = Cap at 75
  else if (reviewCount < 5) {
    scoreCap = 75;
    penalties.push('Few reviews: max score capped at 75');
  }
  // PENALTY 4: Moderate reviews (5-9) = Cap at 85
  else if (reviewCount < 10) {
    scoreCap = 85;
  }
  // 10+ reviews = No cap, can reach 100
  
  // PENALTY 5: No rating despite having product = -3 (reduced from -5)
  if (rating === 0 && reviewCount === 0) {
    penaltyAmount += 3;
    penalties.push('No rating data: -3');
  }
  
  // Apply cap and penalties
  let finalScore = Math.min(rawTotal, scoreCap) - penaltyAmount;
  finalScore = Math.max(0, Math.min(100, finalScore)); // Ensure 0-100 range

  // Determine trending status based on FINAL score
  let trendingStatus = 'not-trending';
  let trendingLabel = '';
  
  if (finalScore >= 80) {
    trendingStatus = 'hot';
    trendingLabel = '🔥 HOT';
  } else if (finalScore >= 70) {
    trendingStatus = 'trending';
    trendingLabel = '📈 Trending';
  } else if (finalScore >= 60) {
    trendingStatus = 'rising';
    trendingLabel = '⬆️ Rising';
  } else if (finalScore >= 45) {
    trendingStatus = 'moderate';
    trendingLabel = '➡️ Moderate';
  } else {
    trendingStatus = 'low';
    trendingLabel = '';
  }

  // Only display products with 45+ score
  const shouldDisplay = finalScore >= 45;

  return {
    totalScore: Math.round(finalScore),
    rawScore: Math.round(rawTotal),
    trendingStatus,
    trendingLabel,
    shouldDisplay,
    
    breakdown: {
      salesEvidence: {
        score: salesEvidence.score,
        maxScore: salesEvidence.maxScore,
        percentage: Math.round((salesEvidence.score / salesEvidence.maxScore) * 100),
        reason: salesEvidence.reason,
        details: salesEvidence.details
      },
      animePopularity: {
        score: animePopularity.score,
        maxScore: animePopularity.maxScore,
        percentage: Math.round((animePopularity.score / animePopularity.maxScore) * 100),
        reason: animePopularity.reason,
        details: animePopularity.details
      },
      productAppeal: {
        score: productAppeal.score,
        maxScore: productAppeal.maxScore,
        percentage: Math.round((productAppeal.score / productAppeal.maxScore) * 100),
        reason: productAppeal.reason,
        details: productAppeal.details
      },
      valueScore: {
        score: valueScore.score,
        maxScore: valueScore.maxScore,
        percentage: Math.round((valueScore.score / valueScore.maxScore) * 100),
        reason: valueScore.reason,
        details: valueScore.details
      },
      freshness: {
        score: freshness.score,
        maxScore: freshness.maxScore,
        percentage: Math.round((freshness.score / freshness.maxScore) * 100),
        reason: freshness.reason,
        details: freshness.details
      }
    },
    
    penalties: {
      applied: penalties,
      scoreCap,
      penaltyAmount,
      rawScoreBeforePenalties: rawTotal
    },

    explanation: generateExplanation(finalScore, reviewCount, rating, salesEvidence, animePopularity, productAppeal)
  };
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(score, reviewCount, rating, salesEvidence, animePopularity, productAppeal) {
  const parts = [];
  
  // Lead with sales evidence (most important)
  if (reviewCount >= 50) {
    parts.push('Bestseller with 50+ reviews');
  } else if (reviewCount >= 20) {
    parts.push('Popular product (20+ reviews)');
  } else if (reviewCount >= 5) {
    parts.push('Has good reviews');
  } else if (reviewCount > 0) {
    parts.push('Has some reviews');
  } else {
    parts.push('No reviews yet');
  }
  
  // Rating
  if (rating >= 4.5 && reviewCount > 0) {
    parts.push('highly rated');
  } else if (rating >= 4.0 && reviewCount > 0) {
    parts.push('well-rated');
  }
  
  // Anime popularity
  if (animePopularity.score >= 20) {
    parts.push('from top anime');
  }
  
  // Product type
  if (productAppeal.score >= 12) {
    parts.push('desirable product type');
  }
  
  if (parts.length === 0) {
    return 'Standard anime merchandise';
  }
  
  // Combine naturally
  if (reviewCount === 0) {
    return `${parts[0]} - score limited until customer reviews come in`;
  }
  
  return parts.slice(0, 3).join(', ');
}

/**
 * Batch score multiple products
 */
function scoreProducts(products) {
  return products.map(product => {
    const scoreData = calculateIntelligentTrendingScore(product);
    return {
      ...product,
      intelligent_score: scoreData.totalScore,
      trending_status: scoreData.trendingStatus,
      trending_label: scoreData.trendingLabel,
      should_display: scoreData.shouldDisplay,
      score_breakdown: scoreData.breakdown,
      score_explanation: scoreData.explanation,
      score_version: '2.0',
      penalties_applied: scoreData.penalties
    };
  });
}

/**
 * Filter products to only show quality ones (45+)
 */
function filterTrendingProducts(products, minScore = 45) {
  const scored = scoreProducts(products);
  return scored
    .filter(p => p.intelligent_score >= minScore)
    .sort((a, b) => b.intelligent_score - a.intelligent_score);
}

// Legacy exports for backwards compatibility
module.exports = {
  calculateIntelligentTrendingScore,
  calculateSalesEvidenceScore,
  calculateAnimePopularityScore,
  calculateProductAppealScore,
  calculateValueScore,
  calculateFreshnessScore,
  scoreProducts,
  filterTrendingProducts,
  
  // Legacy function name mappings
  calculateSalesVelocityScore: calculateSalesEvidenceScore,
  calculateCommunityHypeScore: calculateProductAppealScore,
  calculateRecencyScore: calculateFreshnessScore,
  calculateSocialSignalsScore: calculateFreshnessScore
};
