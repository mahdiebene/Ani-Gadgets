const { matchAnime } = require('./animeMatcher');

function parseCount(value) {
  if (value === undefined || value === null || value === '') return 0;
  const match = String(value).replace(/,/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*([km])?\+?(?:\s+sold)?$/i);
  if (!match) throw new Error(`Unrecognized count: ${value}`);
  return Math.min(2147483647, Math.floor(Number(match[1]) * ({ k: 1000, m: 1000000 }[match[2]?.toLowerCase()] || 1)));
}

function httpsUrl(value, product = false) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing listing URL');
  const url = new URL(value.startsWith('//') ? `https:${value}` : value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe listing URL');
  url.protocol = 'https:';
  if (product) {
    if (!['www.daraz.com.bd', 'daraz.com.bd'].includes(url.hostname) || !url.pathname.startsWith('/products/')) {
      throw new Error('Unexpected product host or path');
    }
    url.hostname = 'www.daraz.com.bd';
    url.search = '';
    url.hash = '';
  }
  return url.toString();
}

function categoryFor(name) {
  const categories = [
    [/\b(figure|statue|figurine)\b/i, 'Figures'],
    [/\b(t[ -]?shirt|hoodie|jacket|sweater|shirt)\b/i, 'Clothing'],
    [/\b(poster|canvas|wall art)\b/i, 'Posters'],
    [/\b(keychain|keyring|key ring)\b/i, 'Keychains'],
    [/\b(sticker|decal)\b/i, 'Stickers'],
    [/\b(bag|backpack|wallet)\b/i, 'Bags'],
    [/\b(phone case|phone cover)\b/i, 'Phone Cases'],
    [/\b(lamp|light|mug|cup|pillow)\b/i, 'Home Decor'],
    [/\b(plush|toy)\b/i, 'Toys']
  ];
  return categories.find(([pattern]) => pattern.test(name))?.[1] || 'Accessories';
}

function normalizeItem(item, keyword, now = new Date().toISOString()) {
  if (!item || typeof item.name !== 'string' || !item.name.trim()) throw new Error('Listing has no name');
  const match = matchAnime(item.name);
  if (!match) return null; // Search results are not evidence of an anime match.
  const price = Number(item.price);
  if (!Number.isFinite(price) || price <= 0 || price >= 100000000) throw new Error('Listing has invalid price');
  const original = Number(item.originalPrice);
  const rating = Number(item.ratingScore || 0);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw new Error('Listing has invalid rating');
  const itemId = String(item.itemId || '');
  if (!/^\d+$/.test(itemId) || BigInt(itemId) > 9223372036854775807n) throw new Error('Listing has invalid itemId');
  const inStock = item.inStock === true || item.inStock === 'true' ? true
    : item.inStock === false || item.inStock === 'false' ? false : null;
  return {
    name: item.name.trim().slice(0, 500),
    product_url: httpsUrl(item.itemUrl, true),
    image_url: httpsUrl(item.image),
    price, original_price: Number.isFinite(original) && original >= price ? original : null,
    rating: Math.round(rating * 100) / 100, reviews_count: parseCount(item.review),
    units_sold: parseCount(item.itemSoldCntShow), daraz_item_id: itemId,
    seller_name: item.sellerName || null, location: item.location || null, brand: item.brandName || null,
    in_stock: inStock, is_available: inStock !== false,
    discount_percent: original > price ? Math.round((1 - price / original) * 100) : 0,
    anime_name: match.name, category: categoryFor(item.name), source: 'daraz',
    search_keyword: keyword, scraped_at: now, last_seen_at: now, first_seen_at: now
  };
}

module.exports = { normalizeItem, parseCount, httpsUrl, categoryFor };