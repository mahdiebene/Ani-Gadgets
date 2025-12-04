const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const supabase = require('../db/supabase');
const { 
  generateBDSearchKeywords, 
  detectAnimeFromProductName,
  POPULAR_ANIME_BD 
} = require('../config/bdAnimeConfig');
const { calculateIntelligentTrendingScore } = require('./intelligentScorerService');

const DARAZ_BASE_URL = 'https://www.daraz.com.bd';
const DELAY_BETWEEN_REQUESTS = parseInt(process.env.SCRAPE_DELAY_MS) || 3000;
const MAX_PRODUCTS_PER_SEARCH = 20;
const MAX_PAGES_PER_SEARCH = 2;

/**
 * Sleep function for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get random user agent
 */
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Initialize Puppeteer browser
 */
async function initBrowser() {
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });
  return browser;
}

/**
 * Scrape Daraz search results for a keyword (BD-optimized)
 */
async function scrapeDarazSearch(page, keyword) {
  const searchUrl = `${DARAZ_BASE_URL}/catalog/?q=${encodeURIComponent(keyword.term)}`;
  console.log(`🔍 Searching: "${keyword.term}" (source: ${keyword.source})`);

  const products = [];

  try {
    await page.setUserAgent(getRandomUserAgent());
    
    for (let pageNum = 1; pageNum <= MAX_PAGES_PER_SEARCH; pageNum++) {
      const pageUrl = pageNum === 1 ? searchUrl : `${searchUrl}&page=${pageNum}`;
      
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for products to load - try multiple selectors
      await page.waitForSelector('[data-qa-locator="product-item"], .gridItem, .c2prKC', { timeout: 10000 })
        .catch(() => null);

      const content = await page.content();
      const $ = cheerio.load(content);

      let foundOnPage = 0;

      // Parse product items - multiple selectors for different Daraz layouts
      $('[data-qa-locator="product-item"], .gridItem, .c2prKC').each((index, element) => {
        if (products.length >= MAX_PRODUCTS_PER_SEARCH) return false;

        try {
          const $el = $(element);
          
          // Extract product name
          const name = $el.find('.RfADt a, .title, [data-qa-locator="product-title"]').text().trim() ||
                      $el.find('a').attr('title')?.trim();
          
          if (!name) return;
          
          // Check if this is an anime product
          const animeMatch = detectAnimeFromProductName(name);
          if (!animeMatch) return; // Skip non-anime products
          
          // Extract product link
          const linkEl = $el.find('a[href*="/products/"], a[href*="daraz.com.bd"]').first();
          const productLink = linkEl.attr('href');
          
          if (!productLink) return;

          // Extract price
          const priceText = $el.find('.ooOxS, .price, [data-qa-locator="product-price"]').first().text().trim();
          const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;

          const originalPriceText = $el.find('.WNoq3, .origPrice, .price--original').text().trim();
          const originalPrice = parseFloat(originalPriceText.replace(/[^\d.]/g, '')) || price;

          // Extract image
          const imageUrl = $el.find('img').attr('src') || $el.find('img').attr('data-src');
          
          // Extract rating and reviews
          const ratingText = $el.find('.rating, .ratig-num').text().trim();
          const rating = parseFloat(ratingText) || 0;

          const reviewsText = $el.find('.review, .rating__review').text().trim();
          const reviewsCount = parseInt(reviewsText.replace(/[^\d]/g, '')) || 0;

          // Construct full URL
          const productUrl = productLink.startsWith('http') 
            ? productLink 
            : `${DARAZ_BASE_URL}${productLink}`;

          // Build product object for intelligent scoring
          const productData = {
            name,
            price,
            original_price: originalPrice,
            image_url: imageUrl,
            product_url: productUrl,
            source: 'daraz',
            anime_name: animeMatch.name,
            anime_match: animeMatch.matched,
            search_keyword: keyword.term,
            reviews_count: reviewsCount,
            rating,
            category: detectCategory(name),
            is_available: true,
            scraped_at: new Date().toISOString()
          };

          // Use Layer 4 Intelligent Scoring System
          const scoreData = calculateIntelligentTrendingScore(productData, animeMatch);

          if (name && productUrl && price > 0) {
            products.push({
              ...productData,
              trending_score: scoreData.totalScore,
              trending_status: scoreData.trendingStatus,
              trending_label: scoreData.trendingLabel,
              score_breakdown: scoreData.breakdown,
              score_explanation: scoreData.explanation
            });
            foundOnPage++;
          }
        } catch (err) {
          // Skip malformed product
        }
      });

      console.log(`   Page ${pageNum}: found ${foundOnPage} anime products`);
      
      if (foundOnPage === 0) break; // No more products
      if (products.length >= MAX_PRODUCTS_PER_SEARCH) break;
      
      await sleep(1500); // Short delay between pages
    }

    console.log(`   Total: ${products.length} products for "${keyword.term}"`);
    return products;
  } catch (error) {
    console.error(`   Error scraping ${keyword.term}:`, error.message);
    return products; // Return what we found
  }
}

/**
 * Detect product category from name
 */
function detectCategory(name) {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('figure') || nameLower.includes('figurine') || nameLower.includes('statue')) {
    return 'Figures';
  }
  if (nameLower.includes('poster') || nameLower.includes('wall') || nameLower.includes('canvas')) {
    return 'Posters & Art';
  }
  if (nameLower.includes('t-shirt') || nameLower.includes('tshirt') || nameLower.includes('shirt') || 
      nameLower.includes('hoodie') || nameLower.includes('clothing')) {
    return 'Clothing';
  }
  if (nameLower.includes('keychain') || nameLower.includes('key chain') || nameLower.includes('keyring')) {
    return 'Keychains';
  }
  if (nameLower.includes('mug') || nameLower.includes('cup')) {
    return 'Mugs & Drinkware';
  }
  if (nameLower.includes('bag') || nameLower.includes('backpack')) {
    return 'Bags';
  }
  if (nameLower.includes('sticker') || nameLower.includes('decal')) {
    return 'Stickers';
  }
  if (nameLower.includes('plush') || nameLower.includes('plushy') || nameLower.includes('stuffed')) {
    return 'Plushies';
  }
  if (nameLower.includes('phone') || nameLower.includes('case') || nameLower.includes('cover')) {
    return 'Phone Cases';
  }
  
  return 'Other';
}

/**
 * Save products to database
 */
async function saveProductsToDatabase(products) {
  console.log(`\n💾 Saving ${products.length} products to database...`);

  const results = { success: 0, failed: 0, skipped: 0 };

  for (const product of products) {
    try {
      // Upsert product
      const { error } = await supabase
        .from('products')
        .upsert({
          name: product.name.substring(0, 500),
          price: product.price,
          original_price: product.original_price,
          image_url: product.image_url,
          product_url: product.product_url,
          source: product.source,
          anime_name: product.anime_name,
          search_keyword: product.search_keyword,
          reviews_count: product.reviews_count,
          rating: product.rating,
          category: product.category,
          trending_score: product.trending_score,
          score_breakdown: product.score_breakdown,
          is_available: product.is_available,
          scraped_at: product.scraped_at
        }, {
          onConflict: 'product_url'
        });

      if (error) {
        if (error.code === '23505') {
          results.skipped++;
        } else {
          console.error(`Failed to save product:`, error.message);
          results.failed++;
        }
      } else {
        results.success++;
      }
    } catch (err) {
      console.error(`Error saving product:`, err.message);
      results.failed++;
    }
  }

  console.log(`✅ Saved: ${results.success}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
  return results;
}

/**
 * Main scraping function - BD-optimized
 */
async function runScraper() {
  console.log('🚀 Starting BD-optimized Daraz scraper...');
  console.log('⏰ Time:', new Date().toISOString());
  console.log('\n📋 Using Bangladesh-specific anime search terms\n');

  let browser;
  const allProducts = [];
  const seenUrls = new Set();

  try {
    // Generate BD-optimized keywords
    const keywords = generateBDSearchKeywords();
    const animePriorityMap = createAnimePriorityMap();
    
    // Limit keywords for reasonable scraping time
    const keywordsToSearch = keywords.slice(0, 25);
    console.log(`🔑 Will search ${keywordsToSearch.length} keywords\n`);

    browser = await initBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Scrape products for each keyword
    for (const keyword of keywordsToSearch) {
      const products = await scrapeDarazSearch(page, keyword, animePriorityMap);
      
      // Deduplicate by URL
      for (const product of products) {
        if (!seenUrls.has(product.product_url)) {
          seenUrls.add(product.product_url);
          allProducts.push(product);
        }
      }

      // Rate limiting
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    console.log(`\n📊 Total unique products found: ${allProducts.length}`);

    // Save to database
    if (allProducts.length > 0) {
      const saveResults = await saveProductsToDatabase(allProducts);

      console.log('\n✅ Scraping complete!');
      return {
        success: true,
        totalFound: allProducts.length,
        saved: saveResults.success,
        skipped: saveResults.skipped,
        failed: saveResults.failed
      };
    } else {
      console.log('\n⚠️ No products found. Daraz might be blocking or layout changed.');
      return {
        success: false,
        message: 'No products found',
        totalFound: 0
      };
    }

  } catch (error) {
    console.error('❌ Scraper failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('🌐 Browser closed');
    }
  }
}

/**
 * Mark unavailable products as stale
 */
async function markStaleProducts(hoursOld = 72) {
  const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('products')
    .update({ is_available: false })
    .lt('scraped_at', cutoffTime);

  if (error) {
    console.error('Error marking stale products:', error.message);
  } else {
    console.log(`Marked products older than ${hoursOld} hours as unavailable`);
  }
}

module.exports = {
  runScraper,
  scrapeDarazSearch,
  saveProductsToDatabase,
  markStaleProducts
};
