const { safeUrl } = require('./validation');

function compareOffers(offers, now = Date.now()) {
  const result = offers.map(offer => {
    const reasons = [];
    const observed = Date.parse(offer.observed_at);
    const expires = Date.parse(offer.expires_at);
    const fresh = Number.isFinite(observed) && observed <= now && Number.isFinite(expires) && expires > now;
    if (!fresh) reasons.push('Stale or unknown observation expiry');
    if (offer.price_kind !== 'full') reasons.push('Not a full price');
    if (offer.currency !== 'BDT') reasons.push('Not priced in BDT');
    if (offer.ships_to_bangladesh !== true || !offer.delivery_destination?.trim()) reasons.push('Delivery not confirmed');
    if (offer.availability !== 'in_stock') reasons.push('Not confirmed in stock');
    if (!offer.condition || offer.condition === 'unknown' || !offer.included_parts?.trim() || !offer.purchase_route || offer.purchase_route === 'unknown') reasons.push('Condition, parts or route incomplete');
    const amounts = ['full_price', 'shipping_amount', 'tax_amount', 'fee_amount'].map(key => offer[key]);
    if (!amounts.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e12)) reasons.push('Incomplete costs');
    const safe = safeUrl(offer.listing_url);
    if (!safe) reasons.push('Purchase link unavailable');
    const total = reasons.length ? null : amounts.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;
    const group = total === null ? null : JSON.stringify([offer.catalogue_product_id, offer.condition, offer.included_parts.trim(), offer.purchase_route, offer.delivery_destination.trim()]);
    return { ...offer, listing_url: safe ? offer.listing_url : null, fresh, comparison_reasons: reasons,
      landed_total: total, comparison_group: group, lowest_complete_total: false };
  });
  const groups = new Map();
  for (const offer of result) {
    if (!offer.comparison_group) continue;
    const group = groups.get(offer.comparison_group) || { count: 0, min: Infinity };
    group.count++; group.min = Math.min(group.min, offer.landed_total);
    groups.set(offer.comparison_group, group);
  }
  for (const offer of result) {
    const group = groups.get(offer.comparison_group);
    offer.lowest_complete_total = Boolean(group && group.count >= 2 && group.min === offer.landed_total);
  }
  return result;
}
module.exports = { compareOffers };