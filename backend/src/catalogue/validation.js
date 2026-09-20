// Local, manually authored records only. Unknown fields fail closed (including images/feeds).
const fields = {
  products: 'key name category anime_name manufacturer product_line manufacturer_code isbn edition variant scale language volume identity_reference_url reviewed published is_demo',
  merchants: 'key name website_url country_code payment_policy_url delivery_policy_url return_policy_url published',
  offers: 'key product merchant listing_url condition included_parts purchase_route reviewed published',
  observations: 'offer observed_at expires_at source_reference currency price_kind full_price deposit_amount shipping_amount tax_amount fee_amount ships_to_bangladesh delivery_destination availability preorder_release_at preorder_terms',
  evidence: 'key product offer evidence_type source_url summary captured_at expires_at reviewed'
};
const enums = {
  condition: ['unknown', 'new', 'used', 'damaged'],
  purchase_route: ['unknown', 'local', 'direct_import', 'proxy', 'request'],
  price_kind: ['unknown', 'full', 'deposit'],
  availability: ['unknown', 'in_stock', 'out_of_stock', 'preorder', 'discontinued'],
  evidence_type: ['seller_claim', 'manufacturer_reference', 'independent_review']
};
const money = ['full_price', 'deposit_amount', 'shipping_amount', 'tax_amount', 'fee_amount'];
const booleans = ['reviewed', 'published', 'is_demo', 'ships_to_bangladesh'];
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !/\s/.test(value);
  } catch { return false; }
}
function validateDocument(input, now = Date.now()) {
  const fail = message => { throw new Error(`Invalid catalogue: ${message}`); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(input)) fail('expected an object');
  for (const key of Object.keys(input)) if (!['version', 'mode', 'reviewer', ...Object.keys(fields)].includes(key)) fail(`unknown field ${key}`);
  if (input.version !== 1 || !['curation', 'observations'].includes(input.mode)) fail('version 1 and mode curation/observations required');
  if (input.mode === 'curation' && (typeof input.reviewer !== 'string' || !input.reviewer.trim() || input.reviewer.length > 100)) fail('reviewer required');
  if (input.reviewer != null && typeof input.reviewer !== 'string') fail('reviewer must be text');
  const result = { version: 1, mode: input.mode, reviewer: input.reviewer?.trim() };
  let count = 0;
  for (const [section, allowed] of Object.entries(fields)) {
    const rows = input[section] === undefined ? [] : input[section];
    if (!Array.isArray(rows) || rows.length > 1000) fail(`${section}: expected up to 1000 rows`);
    if (input.mode === 'observations' && section !== 'observations' && rows.length) fail('observation imports cannot curate');
    const seen = new Set();
    result[section] = rows.map((row, index) => {
      const at = `${section}[${index}]`;
      if (!object(row)) fail(`${at}: object required`);
      const clean = {};
      for (const [key, value] of Object.entries(row)) {
        if (!allowed.split(' ').includes(key)) fail(`${at}: unknown field ${key}`);
        if (value === null) { clean[key] = null; continue; }
        if (money.includes(key)) {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1e12 || value !== Number(value.toFixed(2))) fail(`${at}.${key}: non-negative amount with at most 2 decimals required`);
        } else if (booleans.includes(key)) {
          if (typeof value !== 'boolean') fail(`${at}.${key}: boolean required`);
        } else if (typeof value !== 'string' || !value.trim() || value.length > 2000) fail(`${at}.${key}: nonempty text up to 2000 characters required`);
        clean[key] = typeof value === 'string' ? value.trim() : value;
        if (enums[key] && !enums[key].includes(value)) fail(`${at}.${key}: unsupported value`);
        if (key.endsWith('_url') && !safeUrl(value)) fail(`${at}.${key}: safe HTTP(S) URL required`);
        if (['key', 'product', 'merchant', 'offer'].includes(key) && !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(value)) fail(`${at}.${key}: invalid stable key`);
        if (key.endsWith('_at')) {
          const pattern = key === 'preorder_release_at' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
          if (!pattern.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)) fail(`${at}.${key}: ISO UTC date required`);
          if (['observed_at', 'captured_at'].includes(key) && Date.parse(value) > now) fail(`${at}.${key}: future observation`);
        }
      }
      const requireFields = names => { for (const name of names.split(' ')) if (clean[name] == null) fail(`${at}.${name}: required`); };
      if (section !== 'observations') {
        requireFields('key');
        if (seen.has(clean.key)) fail(`${at}: duplicate key`);
        seen.add(clean.key);
      }
      if (section === 'products') {
        requireFields('name category reviewed published is_demo');
        if (clean.reviewed) requireFields('identity_reference_url');
      }
      if (section === 'merchants') {
        requireFields('name published');
        if (clean.country_code && !/^[A-Z]{2}$/.test(clean.country_code)) fail(`${at}: invalid country code`);
      }
      if (section === 'offers') requireFields('product merchant listing_url condition purchase_route reviewed published');
      if (clean.published && ['products', 'offers'].includes(section) && !clean.reviewed) fail(`${at}: publication requires explicit review`);
      if (section === 'evidence') {
        requireFields('evidence_type source_url summary captured_at reviewed');
        if (Boolean(clean.product) === Boolean(clean.offer)) fail(`${at}: exactly one product or offer required`);
      }
      if (section === 'observations') {
        requireFields('offer observed_at expires_at source_reference currency price_kind availability');
        if (!/^[A-Z]{3}$/.test(clean.currency)) fail(`${at}: currency must have three uppercase letters`);
        if (clean.price_kind === 'full') requireFields('full_price');
        if (clean.price_kind === 'deposit') requireFields('deposit_amount');
        if (clean.deposit_amount != null && clean.full_price != null && clean.deposit_amount > clean.full_price) fail(`${at}: deposit exceeds full price`);
        if (clean.shipping_amount != null) requireFields('delivery_destination');
        const identity = `${clean.offer}:${new Date(clean.observed_at).toISOString()}`;
        if (seen.has(identity)) fail(`${at}: duplicate observation timestamp`);
        seen.add(identity);
      }
      if (clean.expires_at && Date.parse(clean.expires_at) <= Date.parse(clean.observed_at || clean.captured_at)) fail(`${at}: expiry must follow observation`);
      count++;
      return clean;
    });
  }
  if (!count || count > 3000) fail('expected 1–3000 total records');
  return result;
}
module.exports = { validateDocument, safeUrl, money };