// Optional real-browser regression check using Node's built-in Chrome DevTools client.
// Build first; set CHROME_PATH to a Chrome/Chromium executable. No external sites/data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { compareOffers } = require('../../backend/src/catalogue/comparison.js');
const { createDemo } = require('../../backend/src/catalogue/demo.js');

if (!process.env.CHROME_PATH) throw new Error('Set CHROME_PATH to a local Chrome/Chromium executable.');
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
await readFile(join(dist, 'index.html'));
const profile = await mkdtemp(join(tmpdir(), 'anigadgets-browser-'));
const requests = [];
const demo = createDemo();
const catalogue = demo.products.map((product, index) => ({ ...product, id: index + 1 }));
const details = product => {
  const rows = demo.offers.filter(o => o.product === product.key);
  const offers = rows.map((o, index) => ({ ...o, ...demo.observations.find(n => n.offer === o.key),
    ...(product.id === 2 ? { currency: 'USD', full_price: 10, shipping_amount: 2 } : {}),
    id: product.id * 2 + index, catalogue_product_id: product.id,
    merchant_name: demo.merchants.find(m => m.key === o.merchant).name }));
  return { product, offers: compareOffers(offers), history: offers.map(o => ({ ...o, offer_id: o.id })),
    evidence: demo.evidence.filter(e => e.product === product.key) };
};
const fixtures = Array.from({ length: 50 }, (_, index) => ({
  id: index + 1, name: `${index < 45 ? 'Naruto' : 'Gojo'} figure ${index + 1}`,
  product_url: `https://example.test/fixture/${index + 1}`, image_url: '/favicon.svg',
  source: index % 2 ? 'Example shop' : 'daraz', category: 'Figures', anime_name: 'Anime',
  price: index === 0 ? null : 1000, intelligent_score: 30, last_seen_at: '2026-01-01T00:00:00Z'
}));
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      requests.push(url);
      let data;
      let pagination;
      if (url.pathname === '/api/stats') data = { totalProducts: 50, totalAnime: 2 };
      else if (url.pathname === '/api/products/meta/categories') data = ['Figures'];
      else if (url.pathname === '/api/products/meta/anime') data = [];
      else if (url.pathname === '/api/products/meta/sources') data = ['daraz', 'Example shop'];
      else if (url.pathname === '/api/catalogue') {
        const search = url.searchParams.get('search') || '';
        const matches = catalogue.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        const offset = Number(url.searchParams.get('offset') || 0);
        data = matches.slice(offset, offset + 20); pagination = { total: matches.length, offset, limit: 20 };
      } else if (/^\/api\/catalogue\/\d+$/.test(url.pathname)) {
        const product = catalogue.find(p => p.id === Number(url.pathname.split('/').pop()));
        if (!product) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }
        data = details(product);
      } else if (/^\/api\/products\/\d+$/.test(url.pathname)) data = fixtures.find(p => p.id === Number(url.pathname.split('/').pop()));
      else if (url.pathname === '/api/products') {
        const search = url.searchParams.get('search') || '';
        if (search === 'slow') await delay(500);
        const source = url.searchParams.get('source');
        const matches = fixtures.filter(item => (!source || item.source === source) &&
          (search === 'slow' || item.name.toLowerCase().includes(search.toLowerCase())));
        const offset = Number(url.searchParams.get('offset') || 0);
        const limit = Number(url.searchParams.get('limit') || 20);
        data = matches.slice(offset, offset + limit);
        pagination = { total: matches.length, offset, limit };
      } else { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data, pagination }));
      return;
    }
    const filename = resolve(dist, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!filename.startsWith(resolve(dist) + sep)) {
      res.writeHead(403); res.end(); return;
    }
    const body = await readFile(filename);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_PATH, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
const pending = new Map();
const errors = [];
let sequence = 0;
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(`Browser condition not reached: ${expression}`);
}
async function search(term) {
  await evaluate(`(() => {
    const input = document.querySelector('input[aria-label="Search anime merchandise"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(term)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
  })()`);
}
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Chrome debugging port must become available');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback?.reject(new Error(JSON.stringify(message.error)));
      else callback?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
    else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const local = new URL(request.url).origin === base;
      command(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
        requestId, ...(!local && { errorReason: 'BlockedByClient' })
      }).catch(error => errors.push(error.message));
    }
  };
  await command('Runtime.enable');
  await command('Page.enable');
  // Refuse remote traffic even if someone built with a production VITE_API_URL.
  await command('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await command('Page.navigate', { url: base });
  await waitFor('document.querySelectorAll("article").length > 0');
  await search('Naruto');
  await waitFor('document.querySelector("h1")?.textContent === "Search: Naruto" && document.querySelectorAll("#products article").length === 20');
  assert.ok(requests.some(url => url.searchParams.get('search') === 'Naruto'));
  assert.equal(await evaluate('document.querySelector("#products").textContent.includes("Price unknown")'), true);
  assert.equal(await evaluate('document.querySelector("#products").textContent.includes("View on Example shop")'), true);
  await evaluate('document.querySelector("#products article button").click()');
  await waitFor('document.querySelector("#products article button").getAttribute("aria-pressed") === "true"');
  await evaluate(`document.querySelector('button[aria-label="Next page"]').click()`);
  await waitFor('document.querySelector("#products h3")?.textContent.includes("21")');
  await search('Naruto');
  await waitFor('document.querySelector("#products h3")?.textContent === "Naruto figure 1"');
  assert.equal(await evaluate('document.querySelector("#products article button").getAttribute("aria-pressed")'), 'true');
  await evaluate(`(() => { const select = document.querySelector('select[aria-label="Source"]');
    select.value = 'Example shop'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor('document.querySelector("#products h3")?.textContent === "Naruto figure 2"');
  assert.equal(await evaluate('document.querySelector("#products").textContent.includes("View on Daraz")'), false);
  await search('slow');
  await delay(100);
  await search('Gojo');
  await waitFor('document.querySelector("h1")?.textContent === "Search: Gojo" && document.querySelectorAll("#products article").length === 5');
  await delay(600);
  assert.equal(await evaluate('document.querySelector("#products h3").textContent'), 'Gojo figure 46');
  await command('Page.reload');
  await waitFor('document.querySelectorAll("article").length > 0 && !document.querySelector("#products")');
  await search('Naruto');
  await waitFor('document.querySelector("#products article button")?.getAttribute("aria-pressed") === "true"');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#products article button")).opacity'), '1');
  await evaluate(`document.querySelector('a[href="#catalogue"]').click()`);
  await waitFor('document.querySelector("h1")?.textContent === "Reviewed catalogue" && document.querySelectorAll("main article").length === 20');
  await evaluate(`document.querySelector('button[aria-label="Next page"]').click()`);
  await waitFor('document.querySelector("main h2")?.textContent === "Demo figure 21"');
  await evaluate(`document.querySelector('a[href="#catalogue/21"]').click()`);
  await waitFor('document.querySelector("h1")?.textContent === "Demo figure 21"');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Incomplete costs")'), true);
  await evaluate('history.back()');
  await waitFor(`document.querySelector('h1')?.textContent === 'Reviewed catalogue' && Boolean(document.querySelector('a[href="#catalogue/1"]'))`);
  await evaluate(`document.querySelector('a[href="#catalogue/1"]').click()`);
  await waitFor('document.querySelector("h1")?.textContent === "Demo figure 1"');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Lowest complete total in this comparison group")'), true);
  await evaluate(`document.querySelector('button[aria-label="Save Demo figure 1"]').click()`);
  await evaluate(`(() => { const input = document.querySelector('input[aria-label="BDT price target"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2000');
    input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor('document.querySelector("main").textContent.includes("Target reached")');
  await evaluate(`Array.from(document.querySelectorAll('summary')).find(e => e.textContent.includes('Observation history')).click()`);
  assert.equal(await evaluate('document.querySelector("details[open] li")?.textContent.includes("full")'), true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile layout must not overflow');
  await command('Page.reload');
  await waitFor('document.querySelector("h1")?.textContent === "Demo figure 1" && document.querySelector("main").textContent.includes("Target reached")');
  await evaluate(`document.querySelector('a[href="#saved"]').click()`);
  await waitFor('document.querySelector("h1")?.textContent === "Saved items" && document.querySelectorAll("main article").length === 2');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Price target reached")'), true);
  await evaluate(`document.querySelector('button[aria-label="Save Demo figure 1"]').click()`);
  await waitFor('document.querySelectorAll("main article").length === 1');
  await evaluate(`location.hash = 'catalogue/999999'`);
  await waitFor('document.querySelector("main [role=alert]")?.textContent.includes("Not found")');
  await evaluate(`location.hash = 'catalogue/5'`);
  await waitFor('document.querySelector("h1")?.textContent === "Demo figure 5"');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Not a full price")'), true);
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Lowest complete total in this comparison group")'), false);
  await evaluate(`location.hash = 'catalogue/2'`);
  await waitFor('document.querySelector("h1")?.textContent === "Demo manga 2"');
  await evaluate(`Array.from(document.querySelectorAll('summary')).find(e => e.textContent.includes('Manual BDT estimate')).click()`);
  await evaluate(`(() => {
    for (const [selector, value] of [['input[aria-label="Exchange rate for offer 4"]', '120'], ['details[open] input[type=date]', '2026-01-01']]) {
      const input = document.querySelector(selector);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await waitFor('document.querySelector("details[open]").textContent.includes("using your rate 120 dated 2026-01-01")');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Lowest complete total in this comparison group")'), false);
  await evaluate(`(() => {
    const values = JSON.parse(localStorage.getItem('anigadgets:wishlist:v1'));
    values.push('catalogue:999999'); localStorage.setItem('anigadgets:wishlist:v1', JSON.stringify(values));
    window.dispatchEvent(new StorageEvent('storage', { key: 'anigadgets:wishlist:v1' }));
    location.hash = 'saved';
  })()`);
  await waitFor('document.querySelector("main").textContent.includes("No longer available")');
  await evaluate(`Array.from(document.querySelectorAll('main button')).find(e => e.textContent === 'Remove unavailable item').click()`);
  await waitFor('document.querySelectorAll("main article").length === 1');
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: legacy discovery, catalogue pagination/detail/back/reload, prices/deposits, history, saved/unavailable removal, price targets, manual FX, missing product and mobile layout.');
} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await delay(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}