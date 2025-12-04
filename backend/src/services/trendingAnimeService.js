const axios = require('axios');
const supabase = require('../db/supabase');

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const DELAY_BETWEEN_REQUESTS = 1000; // Jikan API rate limit: 3 requests/second

/**
 * Sleep function to respect API rate limits
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch top airing anime from MyAnimeList via Jikan API
 */
async function fetchTopAiringAnime(limit = 25) {
  try {
    console.log('📺 Fetching top airing anime from MyAnimeList...');
    
    const response = await axios.get(`${JIKAN_BASE_URL}/top/anime`, {
      params: {
        filter: 'airing',
        limit: limit
      }
    });

    const anime = response.data.data.map((item, index) => ({
      mal_id: item.mal_id,
      title: item.title,
      title_english: item.title_english || item.title,
      image_url: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
      score: item.score || 0,
      members: item.members || 0,
      popularity_rank: index + 1,
      status: item.status,
      season: item.season,
      year: item.year,
      genres: item.genres?.map(g => g.name) || []
    }));

    console.log(`✅ Found ${anime.length} airing anime`);
    return anime;
  } catch (error) {
    console.error('❌ Error fetching airing anime:', error.message);
    throw error;
  }
}

/**
 * Fetch top popular anime (all time)
 */
async function fetchPopularAnime(limit = 15) {
  try {
    console.log('🌟 Fetching top popular anime...');
    
    await sleep(DELAY_BETWEEN_REQUESTS);
    
    const response = await axios.get(`${JIKAN_BASE_URL}/top/anime`, {
      params: {
        filter: 'bypopularity',
        limit: limit
      }
    });

    const anime = response.data.data.map((item, index) => ({
      mal_id: item.mal_id,
      title: item.title,
      title_english: item.title_english || item.title,
      image_url: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
      score: item.score || 0,
      members: item.members || 0,
      popularity_rank: 100 + index, // Offset to distinguish from airing
      status: item.status,
      season: item.season,
      year: item.year,
      genres: item.genres?.map(g => g.name) || []
    }));

    console.log(`✅ Found ${anime.length} popular anime`);
    return anime;
  } catch (error) {
    console.error('❌ Error fetching popular anime:', error.message);
    throw error;
  }
}

/**
 * Save anime to database (upsert)
 */
async function saveAnimeToDatabase(animeList) {
  console.log(`💾 Saving ${animeList.length} anime to database...`);

  const results = { success: 0, failed: 0 };

  for (const anime of animeList) {
    try {
      const { error } = await supabase
        .from('trending_anime')
        .upsert({
          mal_id: anime.mal_id,
          title: anime.title,
          title_english: anime.title_english,
          image_url: anime.image_url,
          score: anime.score,
          members: anime.members,
          popularity_rank: anime.popularity_rank,
          status: anime.status,
          season: anime.season,
          year: anime.year,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'mal_id'
        });

      if (error) {
        console.error(`Failed to save ${anime.title}:`, error.message);
        results.failed++;
      } else {
        results.success++;
      }
    } catch (err) {
      console.error(`Error saving ${anime.title}:`, err.message);
      results.failed++;
    }
  }

  console.log(`✅ Saved: ${results.success}, Failed: ${results.failed}`);
  return results;
}

/**
 * Generate search keywords for an anime
 */
function generateSearchKeywords(anime) {
  const keywords = [];
  const title = anime.title_english || anime.title;
  
  // Base keywords
  keywords.push(`${title} figure`);
  keywords.push(`${title} poster`);
  keywords.push(`${title} t-shirt`);
  keywords.push(`${title} keychain`);
  keywords.push(`${title} merchandise`);
  
  // Short title version (first 2-3 words)
  const shortTitle = title.split(' ').slice(0, 3).join(' ');
  if (shortTitle !== title) {
    keywords.push(`${shortTitle} figure`);
    keywords.push(`${shortTitle} anime`);
  }

  return keywords;
}

/**
 * Main function to update trending anime
 */
async function updateTrendingAnime() {
  console.log('🚀 Starting trending anime update...');
  console.log('⏰ Time:', new Date().toISOString());

  try {
    // Fetch both airing and popular anime
    const airingAnime = await fetchTopAiringAnime(25);
    await sleep(DELAY_BETWEEN_REQUESTS);
    const popularAnime = await fetchPopularAnime(15);

    // Combine and deduplicate by mal_id
    const allAnime = [...airingAnime];
    for (const anime of popularAnime) {
      if (!allAnime.find(a => a.mal_id === anime.mal_id)) {
        allAnime.push(anime);
      }
    }

    console.log(`📊 Total unique anime: ${allAnime.length}`);

    // Save to database
    const results = await saveAnimeToDatabase(allAnime);

    console.log('✅ Trending anime update complete!');
    return {
      success: true,
      totalAnime: allAnime.length,
      saved: results.success,
      failed: results.failed
    };
  } catch (error) {
    console.error('❌ Failed to update trending anime:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all trending anime from database with search keywords
 */
async function getTrendingAnimeWithKeywords() {
  const { data, error } = await supabase
    .from('trending_anime')
    .select('*')
    .order('popularity_rank', { ascending: true });

  if (error) throw error;
  
  // Handle empty database case
  if (!data || data.length === 0) {
    console.warn('⚠️ No trending anime found in database. Run update-anime first.');
    return [];
  }

  return data.map(anime => ({
    ...anime,
    searchKeywords: generateSearchKeywords(anime)
  }));
}

module.exports = {
  updateTrendingAnime,
  fetchTopAiringAnime,
  fetchPopularAnime,
  getTrendingAnimeWithKeywords,
  generateSearchKeywords
};
