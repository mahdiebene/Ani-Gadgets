// Repository double. SQL generation/transactions are tested separately.
function fakeDatabase(respond) {
  const calls = [];
  const db = new Proxy({ calls }, { get(target, method) {
    if (method === 'calls') return calls;
    if (method === 'transaction') return async work => {
      calls.push({ method: 'transaction', args: [] });
      return work(db);
    };
    return async (...args) => {
      const call = { method, args };
      calls.push(call);
      if (respond) return respond(call);
      if (method === 'listProducts') return { products: [], total: 0 };
      if (['getProduct', 'getAnime', 'lastUpdated'].includes(method)) return null;
      if (method === 'metadata') return { categories: [], anime: [] };
      return [];
    };
  } });
  return db;
}

const listing = (overrides = {}) => ({
  name: 'Naruto action figure', itemId: '123456',
  itemUrl: '//www.daraz.com.bd/products/naruto-i123456.html?tracking=1',
  image: '//static-01.daraz.com.bd/p/naruto.jpg', price: '450', originalPrice: '900',
  ratingScore: '4.85', review: '50', itemSoldCntShow: '424 sold', inStock: true,
  sellerName: 'Figure Shop', location: 'Dhaka', brandName: 'No Brand', ...overrides
});

module.exports = { fakeDatabase, listing };