export function sourceLabel(source) {
  const value = typeof source === 'string' ? source.trim() : '';
  if (!value) return 'Unknown source';
  return value.toLowerCase() === 'daraz' ? 'Daraz' : value;
}

export function purchaseLink(product) {
  try {
    const url = new URL(product.product_url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const label = product.source?.trim() ? sourceLabel(product.source)
      : product.seller_name?.trim() || url.hostname;
    return { href: url.href, label: `View on ${label}` };
  } catch {
    return null;
  }
}

export function listingKey(product) {
  const id = String(product.id ?? '');
  return /^[1-9]\d*$/.test(id) ? `listing:${id}` : null;
}