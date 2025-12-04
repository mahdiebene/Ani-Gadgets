/**
 * Format price in BDT
 */
export function formatPrice(price) {
  if (!price) return '৳0';
  return `৳${price.toLocaleString('en-BD')}`;
}

/**
 * Get score color based on value
 */
export function getScoreColor(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 70) return 'bg-yellow-500';
  if (score >= 60) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Get score label
 */
export function getScoreLabel(score) {
  if (score >= 80) return '🔥 Hot';
  if (score >= 70) return '⚡ Trending';
  if (score >= 60) return '✨ Popular';
  return '📈 Rising';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format date relative to now
 */
export function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-BD');
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(originalPrice, currentPrice) {
  if (!originalPrice || !currentPrice || originalPrice <= currentPrice) {
    return 0;
  }
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}
