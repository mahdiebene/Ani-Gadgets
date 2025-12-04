const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// IMPORTANT: Static routes MUST come before dynamic :id routes

// GET /api/products/meta/categories - Get all categories
router.get('/meta/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('is_available', true);

    if (error) throw error;

    // Get unique categories
    const categories = [...new Set(data.map(p => p.category).filter(Boolean))];

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/meta/anime - Get all anime names
router.get('/meta/anime', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('anime_name')
      .eq('is_available', true);

    if (error) throw error;

    // Get unique anime names
    const animeNames = [...new Set(data.map(p => p.anime_name).filter(Boolean))].sort();

    res.json({ success: true, data: animeNames });
  } catch (error) {
    console.error('Error fetching anime names:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/anime/:animeName - Get products by anime name
router.get('/anime/:animeName', async (req, res) => {
  try {
    const { animeName } = req.params;
    const { limit = 20 } = req.query;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .ilike('anime_name', animeName)
      .eq('is_available', true)
      .order('trending_score', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching products by anime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products - Get all trending products
router.get('/', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      minScore = 0,
      category,
      anime,
      minPrice,
      maxPrice,
      sortBy = 'intelligent_score', // Default to intelligent score
      sortOrder = 'desc',
      search,
      scoredOnly = 'false' // Only show products with intelligent scores
    } = req.query;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_available', true);

    // Apply score filters based on what's available
    if (scoredOnly === 'true') {
      // Only show products with intelligent scores
      query = query.not('intelligent_score', 'is', null);
      if (parseInt(minScore) > 0) {
        query = query.gte('intelligent_score', parseInt(minScore));
      }
    } else if (parseInt(minScore) > 0) {
      // Filter by whichever score is available
      // Use OR to check both fields
      query = query.or(`intelligent_score.gte.${minScore},and(intelligent_score.is.null,trending_score.gte.${minScore})`);
    }

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (anime) {
      query = query.ilike('anime_name', anime);
    }

    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice));
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,anime_name.ilike.%${search}%`);
    }

    // Apply sorting - prefer intelligent_score, fall back to trending_score
    const validSortFields = ['intelligent_score', 'trending_score', 'price', 'scraped_at', 'reviews_count', 'times_seen'];
    let sortField = validSortFields.includes(sortBy) ? sortBy : 'intelligent_score';
    
    // If sorting by intelligent_score but products might not have it yet,
    // we need to handle nulls properly
    if (sortField === 'intelligent_score') {
      // First try intelligent_score, nulls at the end
      query = query.order('intelligent_score', { 
        ascending: sortOrder === 'asc',
        nullsFirst: false 
      });
      // Then fall back to trending_score for null intelligent_score
      query = query.order('trending_score', { 
        ascending: sortOrder === 'asc'
      });
    } else {
      query = query.order(sortField, { 
        ascending: sortOrder === 'asc'
      });
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
