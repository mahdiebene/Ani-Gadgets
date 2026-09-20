import { useEffect, useState, useSyncExternalStore } from 'react';
import { wishlistStore } from '../utils/wishlist';
import { fetchProduct, fetchCatalogueProduct } from '../utils/api';
import ProductCard from './ProductCard';
import { money, lowestTotal, readTarget } from '../utils/catalogue';
import { SaveCatalogue } from './CataloguePage';
import Pagination from './Pagination';

export default function SavedPage() {
  const saved = useSyncExternalStore(wishlistStore.subscribe, wishlistStore.getSnapshot, wishlistStore.getServerSnapshot);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(null);
  const [revision, setRevision] = useState(0);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(saved.length / 20)));
  useEffect(() => {
    const controller = new AbortController(); setRows(null);
    async function load() {
      const entries = saved.slice((currentPage - 1) * 20, currentPage * 20);
      const output = [];
      // Bounded concurrency avoids a burst of requests for large wishlists.
      for (let offset = 0; offset < entries.length; offset += 4) {
        if (controller.signal.aborted) return;
        output.push(...await Promise.all(entries.slice(offset, offset + 4).map(async key => {
          const [kind, id] = key.split(':');
          try {
            const data = await (kind === 'listing' ? fetchProduct : fetchCatalogueProduct)(id, { signal: controller.signal });
            return { key, kind, data };
          } catch (error) { return { key, kind, error: error.status === 404 ? 'No longer available' : 'Temporarily unavailable — try Refresh' }; }
        })));
      }
      if (!controller.signal.aborted) setRows(output);
    }
    load(); return () => controller.abort();
  }, [saved, currentPage, revision]);
  return <section className="max-w-7xl mx-auto p-4 space-y-4">
    <h1 className="text-2xl font-bold">Saved items</h1>
    <p>Saved only on this browser; blocked storage means session-only saving. Price targets are checked when loading or refreshing, not in the background.</p>
    <button className="border p-2 rounded" onClick={() => setRevision(n => n + 1)}>Refresh saved items</button>
    {!saved.length ? <p>No saved items yet. Save a listing or catalogue product to see it here.</p> : !rows ? <p role="status">Loading saved items…</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {rows.map(row => row.error ? <article key={row.key} className="border border-[var(--color-border)] p-3">
        <p>{row.key}: {row.error}</p><button className="underline" onClick={() => wishlistStore.toggle(row.key)}>Remove unavailable item</button>
      </article> : row.kind === 'listing' ? <ProductCard key={row.key} product={row.data} /> : <article key={row.key} className="border border-[var(--color-border)] p-3 space-y-3">
        {row.data.product.is_demo && <p>Fictional demo</p>}
        <h2><a className="underline" href={`#catalogue/${row.data.product.id}`}>{row.data.product.name}</a></h2>
        <p>Lowest eligible complete offer: {money(lowestTotal(row.data.offers))}. Check condition/destination on detail page.</p>
        <p>{Number(readTarget(row.data.product.id)) > 0 && lowestTotal(row.data.offers) != null && lowestTotal(row.data.offers) <= Number(readTarget(row.data.product.id)) ? 'Price target reached' : 'No current target match'}</p>
        <SaveCatalogue product={row.data.product} />
      </article>)}
    </div>}
    <Pagination currentPage={currentPage} totalPages={Math.ceil(saved.length / 20)} totalItems={saved.length} onPageChange={setPage} />
  </section>;
}