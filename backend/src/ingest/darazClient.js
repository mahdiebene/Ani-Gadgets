const axios = require('axios');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseCatalog(data, requestedPage) {
  const items = data?.mods?.listItems;
  const info = data?.mainInfo;
  const total = Number(info?.totalResults);
  const pageSize = Number(info?.pageSize);
  const page = Number(info?.page);
  if (!Array.isArray(items) || !Number.isInteger(total) || total < 0 ||
      !Number.isInteger(pageSize) || pageSize < 1 || page !== requestedPage ||
      (info.bizCode !== undefined && Number(info.bizCode) !== 0) || info.errorMsg) {
    throw new Error('Invalid Daraz catalogue response (possible challenge or API change)');
  }
  if ((total > 0 && items.length === 0) || (total === 0 && items.length > 0)) {
    throw new Error('Inconsistent Daraz result count (possible anti-bot response)');
  }
  return { items, total, pageSize, complete: page * pageSize >= total };
}

function createDarazClient({ request = axios.get, delayMs = 3000, maxRequests = 100, retries = 2, wait = sleep } = {}) {
  let requests = 0;
  async function fetchPage(term, page) {
    for (let attempt = 0; ; attempt++) {
      if (requests >= maxRequests) throw new Error('Daraz request budget exhausted');
      if (requests > 0) await wait(delayMs * (attempt ? 2 ** attempt : 1));
      requests++;
      try {
        const response = await request('https://www.daraz.com.bd/catalog/', {
          params: { ajax: true, q: term, page }, timeout: 20000, maxRedirects: 0,
          maxContentLength: 5 * 1024 * 1024,
          headers: { Accept: 'application/json', 'User-Agent': 'AniGadgetsHub/1.0 (+https://anigadgetsbd.app)' }
        });
        if (!String(response.headers['content-type']).includes('application/json')) {
          throw new Error('Daraz returned non-JSON content (possible challenge)');
        }
        return parseCatalog(response.data, page);
      } catch (error) {
        const status = error.response?.status;
        const retryable = !status || status === 429 || status >= 500;
        // Malformed/challenged content fails immediately; don't hammer the endpoint.
        if (!error.isAxiosError || !retryable || attempt >= retries) throw error;
      }
    }
  }
  async function search(term, maxPages = 2) {
    const items = [];
    for (let page = 1; page <= maxPages && requests < maxRequests; page++) {
      const result = await fetchPage(term, page);
      items.push(...result.items);
      if (result.complete) return { items, complete: true };
    }
    return { items, complete: false };
  }
  return { search, fetchPage, get requests() { return requests; }, get exhausted() { return requests >= maxRequests; } };
}

module.exports = { createDarazClient, parseCatalog };