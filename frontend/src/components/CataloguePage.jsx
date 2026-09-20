import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchCatalogue, fetchCatalogueProduct } from '../utils/api';
import { wishlistStore } from '../utils/wishlist';
import { money, estimateBdt, lowestTotal, readTarget, saveTarget } from '../utils/catalogue';
import { purchaseLink } from '../utils/listings';
import Pagination from './Pagination';

const inputClass = 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 rounded text-sm';
const buttonClass = 'border border-[var(--color-border)] px-3 py-2 rounded hover:border-[var(--color-accent)]';
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Unknown';

export function SaveCatalogue({ product }) {
  const saved = useSyncExternalStore(wishlistStore.subscribe, wishlistStore.getSnapshot, wishlistStore.getServerSnapshot);
  const key = `catalogue:${product.id}`;
  return <button className={buttonClass} aria-label={`Save ${product.name}`} aria-pressed={saved.includes(key)} onClick={() => wishlistStore.toggle(key)}>
    {saved.includes(key) ? 'Saved — remove' : 'Save item'}
  </button>;
}

export default function CataloguePage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setResult(null);
    fetchCatalogue({ search, page }, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [search, page, retry]);
  return <section className="max-w-7xl mx-auto p-4 space-y-4 break-words">
    <h1 className="text-2xl font-bold">Reviewed catalogue</h1>
    <p>Manually reviewed product identities, not authenticity guarantees. Daraz discovery remains separate. No automatic title matching.</p>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setPage(1); setRetry(n => n + 1); }}>
      <input className={`${inputClass} flex-1 min-w-0`} aria-label="Search catalogue" value={query} onChange={e => setQuery(e.target.value)} maxLength={200} placeholder="Name, anime, ISBN or manufacturer code" />
      <button className={buttonClass}>Search catalogue</button>
    </form>
    {error ? <p role="alert">Catalogue unavailable: {error}. <button className={buttonClass} onClick={() => setRetry(n => n + 1)}>Retry</button></p>
      : !result ? <p role="status">Loading catalogue…</p>
        : <>
          {!result.data.length && <p>No reviewed products found. Use Discover for existing listings; the local catalogue is populated manually.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.data.map(product => <article key={product.id} className="border border-[var(--color-border)] p-4 rounded space-y-2">
              {product.is_demo && <p className="font-bold text-amber-500">Fictional demo — not real inventory</p>}
              <h2 className="font-semibold"><a className="underline" href={`#catalogue/${product.id}`}>{product.name}</a></h2>
              <p>{product.category} · {product.manufacturer || 'Manufacturer unknown'}</p>
              <p>{product.manufacturer_code || product.isbn || 'Code unknown'} · {product.edition || 'Edition unknown'} · {product.variant || 'Variant unknown'}</p>
              <SaveCatalogue product={product} />
            </article>)}
          </div>
          <Pagination currentPage={page} totalPages={Math.ceil(result.pagination.total / 20)} totalItems={result.pagination.total} onPageChange={setPage} />
        </>}
    <BuyingChecklist />
  </section>;
}

function External({ url, children }) {
  const link = purchaseLink({ product_url: url });
  return link ? <a className="underline" href={link.href} target="_blank" rel="noopener noreferrer">{children}</a> : null;
}

function Estimate({ offer }) {
  const [rate, setRate] = useState('');
  const [date, setDate] = useState('');
  const total = estimateBdt([offer.full_price, offer.shipping_amount, offer.tax_amount, offer.fee_amount], rate, date);
  if (offer.currency === 'BDT' || offer.price_kind !== 'full') return null;
  return <details className="mt-3"><summary>Manual BDT estimate (not a seller quote)</summary>
    <div className="flex flex-wrap gap-2 py-2">
      <label>BDT per {offer.currency} <input className={`${inputClass} max-w-full`} aria-label={`Exchange rate for offer ${offer.id}`} type="number" min="0.000001" step="any" value={rate} onChange={e => setRate(e.target.value)} /></label>
      <label>Rate date <input className={inputClass} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    </div>
    <p>{total == null ? 'Enter a positive rate and past/current date. All four cost components must be known.' : `Estimated ${money(total)} using your rate ${rate} dated ${date}.`}</p>
    <p>Assumes the displayed full price, shipping, tax and fees in {offer.currency}; no live FX feed. Not used for comparison ranking.</p>
  </details>;
}

function PriceTarget({ product, offers }) {
  const [target, setTarget] = useState(() => readTarget(product.id));
  const [message, setMessage] = useState('');
  const total = lowestTotal(offers);
  return <div className="border border-[var(--color-border)] p-3 space-y-2">
    <label>My BDT price target <input className={`${inputClass} max-w-full`} aria-label="BDT price target" type="number" min="0.01" step="0.01" value={target} onChange={e => {
      setTarget(e.target.value);
      setMessage(saveTarget(product.id, e.target.value) ? 'Saved on this browser.' : 'Session only: storage unavailable or target invalid.');
    }} /></label>
    <p role="status">{message} {Number(target) > 0 && total != null && total <= Number(target) ? 'Target reached by at least one complete offer. Check condition, parts and destination below.' : 'No current target match.'}</p>
    <p className="text-sm">Checked when this page loads or you press Refresh. No background monitoring or messages. Local browser only.</p>
  </div>;
}

export function CatalogueDetail({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    fetchCatalogueProduct(id, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id, revision]);
  // Re-fetch as soon as a displayed observation expires, not only on navigation.
  useEffect(() => {
    const expiry = Math.min(...(data?.offers || []).map(o => Date.parse(o.expires_at)).filter(n => n > Date.now()));
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(() => setRevision(n => n + 1), Math.min(expiry - Date.now() + 100, 2147483647));
    return () => clearTimeout(timer);
  }, [data]);
  return <section className="max-w-5xl mx-auto p-4 space-y-4 break-words">
    <div className="flex justify-between"><a className="underline" href="#catalogue">Back to catalogue</a><button className={buttonClass} onClick={() => setRevision(n => n + 1)}>Refresh</button></div>
    {error ? <p role="alert">Could not load this product: {error}</p> : !data ? <p role="status">Loading product…</p> : <>
      {data.product.is_demo && <p className="text-amber-500 font-bold">Fictional demo — no real stock, sellers or purchase claims</p>}
      <h1 className="text-2xl font-bold">{data.product.name}</h1>
      <SaveCatalogue product={data.product} />
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {['category', 'anime_name', 'manufacturer', 'product_line', 'manufacturer_code', 'isbn', 'edition', 'variant', 'scale', 'language', 'volume'].map(key => <div key={key}><dt className="text-sm opacity-70">{key.replaceAll('_', ' ')}</dt><dd>{data.product[key] || 'Unknown'}</dd></div>)}
      </dl>
      <External url={data.product.identity_reference_url}>Identity reference</External>
      <p>Identity reviewed manually; seller stock and authenticity are not guaranteed. Lowest labels require at least two comparable, fresh, complete BDT offers with identical condition, parts, route and destination.</p>
      <PriceTarget key={id} product={data.product} offers={data.offers} />
      <h2 className="text-xl font-semibold">Offers</h2>
      {!data.offers.length && <p>No published reviewed offers. Unknown matches are excluded.</p>}
      {data.offers.map(offer => <article key={offer.id} className="border border-[var(--color-border)] rounded p-4 space-y-2">
        <h3 className="font-bold">{offer.merchant_name}</h3>
        {offer.lowest_complete_total && <p className="text-[var(--color-accent)]">Lowest complete total in this comparison group</p>}
        <p>Condition: {offer.condition} · Parts: {offer.included_parts || 'Unknown'} · Route: {offer.purchase_route}</p>
        <p>Stock: {offer.availability || 'Unknown'} · {offer.fresh ? 'Within observation window' : 'Stale or expiry unknown — reconfirm'}</p>
        <p>Observed: {stamp(offer.observed_at)} · Expires: {stamp(offer.expires_at)}</p>
        <p>Price type: {offer.price_kind || 'unknown'} · Full price: {money(offer.full_price, offer.currency)} · Deposit: {money(offer.deposit_amount, offer.currency)}</p>
        <p>Shipping: {money(offer.shipping_amount, offer.currency)} · Tax: {money(offer.tax_amount, offer.currency)} · Fees: {money(offer.fee_amount, offer.currency)}</p>
        <p>Bangladesh delivery: {offer.ships_to_bangladesh == null ? 'Unknown' : offer.ships_to_bangladesh ? 'Reported eligible' : 'Not eligible'} · Destination: {offer.delivery_destination || 'Unknown'}</p>
        <p className="font-semibold">Complete total: {money(offer.landed_total)}</p>
        {!!offer.comparison_reasons.length && <p>Not ranked: {offer.comparison_reasons.join('; ')}.</p>}
        {offer.availability === 'preorder' && <p>Release: {offer.preorder_release_at?.slice(0, 10) || 'Unknown'} · Terms: {offer.preorder_terms || 'Unknown — confirm balance, cancellation and refund terms'}</p>}
        <p><External url={offer.listing_url}>View listing at {offer.merchant_name}</External></p>
        <div className="flex flex-wrap gap-4">{['payment', 'delivery', 'return'].map(kind => offer[`${kind}_policy_url`] ? <External key={kind} url={offer[`${kind}_policy_url`]}>{kind} policy</External> : <span key={kind}>{kind} policy unknown</span>)}</div>
        <Estimate offer={offer} />
        <details><summary>Observation history (latest 20)</summary>
          <ul>{data.history.filter(row => row.offer_id === offer.id).map(row => <li key={row.observed_at} className="py-1">{stamp(row.observed_at)} — {row.price_kind}: {money(row.price_kind === 'deposit' ? row.deposit_amount : row.full_price, row.currency)} · {row.availability}</li>)}</ul>
        </details>
      </article>)}
      <h2 className="text-xl font-semibold">References and claims</h2>
      <p>A seller claim, manufacturer reference and independent review are different kinds of information. None alone proves that a seller's item is genuine.</p>
      {!data.evidence.length && <p>No reviewed current references.</p>}
      {data.evidence.map((row, index) => <div key={index} className="border border-[var(--color-border)] p-3">
        <p className="font-semibold">{row.evidence_type.replaceAll('_', ' ')} · {row.offer_id ? `Offer ${row.offer_id}` : 'Product identity'}</p>
        <p>{row.summary}</p><p>Captured {stamp(row.captured_at)} · Expires {stamp(row.expires_at)}</p><External url={row.source_url}>Open reference</External>
      </div>)}
      <BuyingChecklist />
    </>}
  </section>;
}

export function BuyingChecklist() {
  return <details className="border border-[var(--color-border)] p-4"><summary>Before buying: Bangladesh buyer checklist</summary>
    <ul className="list-disc pl-5 space-y-2 mt-3">
      <li>Check manufacturer code/ISBN, edition, variant, scale, language and volume. Similar titles do not mean identical products.</li>
      <li>Confirm condition, all included parts and actual item photos. A low price, demand score or reference link is not an authenticity guarantee.</li>
      <li>Confirm current stock, Bangladesh shipping, your exact destination, delivery time, payment and return terms directly before paying.</li>
      <li>For pre-orders, distinguish the deposit from the full amount and check balance due, cancellation and refund terms.</li>
      <li>For imports/proxies, include shipping, tax, fees and exchange-rate assumptions. Unknown is not free. This site does not handle payments.</li>
    </ul>
  </details>;
}