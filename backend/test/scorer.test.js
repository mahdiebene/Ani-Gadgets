const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateIntelligentTrendingScore: score, calculateFreshnessScore, WEIGHTS, DISPLAY_MIN_SCORE } = require('../src/services/intelligentScorerService');

test('one 100-point formula and a 45-point classification threshold', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.equal(DISPLAY_MIN_SCORE, 45);
});
test('unproven popular figure cannot outrank comparable 400-sold merchandise', () => {
  const unproven = { name: 'Naruto figure', anime_name: 'Naruto', price: 200, original_price: 500,
    reviews_count: 0, rating: 5, units_sold: 0, first_seen_at: new Date().toISOString(), in_stock: true, location: 'Dhaka' };
  const proven = { ...unproven, units_sold: 400 };
  assert.ok(score(proven).totalScore > score(unproven).totalScore);
  assert.ok(score(unproven).totalScore <= 40);
  assert.equal(score(unproven).breakdown.salesEvidence.score, 0);
  assert.ok(score({ ...proven, anime_name: 'Anime' }).totalScore > score(unproven).totalScore);
});
test('Dhaka and confirmed stock improve appeal; out-of-stock is not recommended', () => {
  const product = { name: 'Naruto figure', units_sold: 400, anime_name: 'Naruto', price: 500 };
  assert.ok(score({ ...product, location: 'Dhaka', in_stock: true }).totalScore > score({ ...product, location: 'Overseas' }).totalScore);
  assert.equal(score({ ...product, in_stock: false }).shouldDisplay, false);
});
test('freshness uses first seen, is not reset by scraping, and never mutates availability', () => {
  const old = { first_seen_at: '2020-01-01T00:00:00Z', scraped_at: new Date().toISOString(), is_available: true };
  assert.equal(calculateFreshnessScore(old).score, 0);
  assert.equal(calculateFreshnessScore({ scraped_at: new Date().toISOString() }).score, 0);
  score(old);
  assert.equal(old.is_available, true);
});