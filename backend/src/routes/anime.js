const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET /api/anime - Get all trending anime
router.get('/', async (req, res) => {
  try {
    const { limit = 25, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('trending_anime')
      .select('*')
      .order('popularity_rank', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching anime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/anime/:malId - Get single anime by MAL ID
router.get('/:malId', async (req, res) => {
  try {
    const { malId } = req.params;

    const { data, error } = await supabase
      .from('trending_anime')
      .select('*')
      .eq('mal_id', parseInt(malId))
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Anime not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching anime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/anime/:malId/products - Get products for specific anime
router.get('/:malId/products', async (req, res) => {
  try {
    const { malId } = req.params;
    const { limit = 20 } = req.query;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('anime_id', parseInt(malId))
      .eq('is_available', true)
      .order('trending_score', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching anime products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
