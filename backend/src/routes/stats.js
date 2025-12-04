const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET /api/stats - Get platform statistics
router.get('/', async (req, res) => {
  try {
    // Get total products count
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true);

    // Get trending products count (score >= 60)
    const { count: trendingProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true)
      .gte('trending_score', 60);

    // Get anime count
    const { count: totalAnime } = await supabase
      .from('trending_anime')
      .select('*', { count: 'exact', head: true });

    // Get top anime by product count
    const { data: topAnime } = await supabase
      .from('products')
      .select('anime_title, anime_id')
      .eq('is_available', true)
      .gte('trending_score', 60);

    // Count products per anime
    const animeProductCount = {};
    topAnime?.forEach(p => {
      if (p.anime_title) {
        animeProductCount[p.anime_title] = (animeProductCount[p.anime_title] || 0) + 1;
      }
    });

    const topAnimeByProducts = Object.entries(animeProductCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, productCount: count }));

    // Get price range
    const { data: priceData } = await supabase
      .from('products')
      .select('price')
      .eq('is_available', true)
      .gte('trending_score', 60)
      .order('price', { ascending: true });

    const prices = priceData?.map(p => p.price).filter(p => p > 0) || [];
    const priceRange = {
      min: prices[0] || 0,
      max: prices[prices.length - 1] || 0,
      average: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
    };

    // Get last update time
    const { data: lastUpdate } = await supabase
      .from('products')
      .select('scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(1);

    res.json({
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        trendingProducts: trendingProducts || 0,
        totalAnime: totalAnime || 0,
        topAnimeByProducts,
        priceRange,
        lastUpdated: lastUpdate?.[0]?.scraped_at || null,
        currency: 'BDT'
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
