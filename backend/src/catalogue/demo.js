// Entirely invented text, no images or remote requests. Never a real supplier seed.
function createDemo(now = Date.now(), size = 100) {
  const observed = new Date(now - 3600000).toISOString();
  const expires = new Date(now + 86400000).toISOString();
  const doc = { version: 1, mode: 'curation', reviewer: 'Local demo', products: [], merchants: [
    { key: 'demo-a', name: 'Fictional demo shop A', published: true },
    { key: 'demo-b', name: 'Fictional demo shop B', published: true }
  ], offers: [], observations: [], evidence: [] };
  for (let i = 1; i <= size; i++) {
    const key = `demo-${i}`;
    doc.products.push({ key, name: `Demo ${i % 2 ? 'figure' : 'manga'} ${i}`, category: i % 2 ? 'Figures' : 'Manga',
      manufacturer: 'Invented demo maker', manufacturer_code: `DEMO-${i}`, edition: 'Standard demo edition',
      variant: 'Default', identity_reference_url: `https://example.test/${key}`, reviewed: true, published: true, is_demo: true });
    for (const shop of ['a', 'b']) {
      const offer = `${key}-${shop}`;
      doc.offers.push({ key: offer, product: key, merchant: `demo-${shop}`, listing_url: `https://example.test/${offer}`,
        condition: 'new', included_parts: 'Complete demo set', purchase_route: 'local', reviewed: true, published: true });
      doc.observations.push({ offer, observed_at: observed, expires_at: expires, source_reference: 'Invented fixture, not an observed listing',
        currency: 'BDT', price_kind: i % 5 === 0 ? 'deposit' : 'full', full_price: i % 5 === 0 ? null : 1000 + i + (shop === 'b' ? 100 : 0),
        deposit_amount: i % 5 === 0 ? 200 : null, shipping_amount: i % 7 === 0 ? null : 60, tax_amount: 0, fee_amount: 0,
        delivery_destination: 'Dhaka', ships_to_bangladesh: true, availability: i % 5 === 0 ? 'preorder' : 'in_stock' });
    }
    doc.evidence.push({ key: `${key}-ref`, product: key, evidence_type: 'manufacturer_reference', source_url: `https://example.test/${key}`,
      summary: 'Fictional reference for testing only; no authenticity claim.', captured_at: observed, reviewed: true });
  }
  return doc;
}
module.exports = { createDemo };