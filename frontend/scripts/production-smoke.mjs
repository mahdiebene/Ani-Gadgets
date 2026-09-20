// Explicit production smoke: GET requests only, browser-local saves, no database writes.
// Blocks third-party resources; run manually after deployment, never as a fixture test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

if (!process.env.CHROME_PATH) throw new Error('Set CHROME_PATH to a local Chrome executable.');
const base = 'https://www.anigadgetsbd.app';
const api = 'https://api.anigadgetsbd.app';
const profile = await mkdtemp(join(tmpdir(), 'anigadgets-production-'));
const chrome = spawn(process.env.CHROME_PATH, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
let sequence = 0;
const pending = new Map();
const errors = [];
const responses = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, {
      resolve: value => { clearTimeout(timeout); resolve(value); },
      reject: error => { clearTimeout(timeout); reject(error); }
    });
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
    await delay(150);
  }
  throw new Error(`Browser condition not reached: ${expression}`);
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
      const callback = pending.get(message.id); pending.delete(message.id);
      if (message.error) callback?.reject(new Error(JSON.stringify(message.error)));
      else callback?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
    else if (message.method === 'Network.responseReceived' && message.params.response.url.startsWith(api + '/')) {
      responses.push({ url: message.params.response.url, status: message.params.response.status });
    } else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const allowed = [base, api].includes(new URL(request.url).origin) && request.method === 'GET';
      command(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
        requestId, ...(!allowed && { errorReason: 'BlockedByClient' })
      }).catch(error => errors.push(error.message));
    }
  };
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Network.enable');
  await command('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await command('Page.navigate', { url: `${base}/#catalogue` });
  await waitFor('document.querySelector("h1")?.textContent === "Reviewed catalogue" && !document.querySelector("main [role=status]")');
  assert.equal(await evaluate('Boolean(document.querySelector("main [role=alert]"))'), false);
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Fictional demo")'), false);
  const live = await evaluate(`(async () => {
    const get = async path => {
      const response = await fetch(${JSON.stringify(api)} + path);
      if (!response.ok) throw new Error(path + ': ' + response.status);
      return response.json();
    };
    const catalogue = await get('/api/catalogue?limit=1');
    const listings = await get('/api/products?limit=1&source=daraz');
    const sources = await get('/api/products/meta/sources');
    return { catalogue: catalogue.pagination.total, listings: listings.pagination.total, sources: sources.data };
  })()`);
  assert.ok(live.listings >= 100 && live.sources.includes('daraz'));
  await evaluate('document.querySelector(\'a[href="#discover"]\').click()');
  await waitFor('document.querySelectorAll("article").length > 0');
  await evaluate(`(() => {
    const input = document.querySelector('input[aria-label="Search anime merchandise"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Naruto');
    input.dispatchEvent(new Event('input', { bubbles: true })); input.form.requestSubmit();
  })()`);
  await waitFor('document.querySelector("h1")?.textContent === "Search: Naruto" && document.querySelectorAll("#products article").length > 0');
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Source"]');
    select.value = 'daraz'; select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor('document.querySelector("#products article button") != null');
  await evaluate('document.querySelector("#products article button").click()');
  await waitFor('document.querySelector("#products article button")?.getAttribute("aria-pressed") === "true"');
  await evaluate('document.querySelector(\'a[href="#saved"]\').click()');
  await waitFor('document.querySelector("h1")?.textContent === "Saved items" && document.querySelectorAll("main article").length === 1');
  await command('Page.reload');
  await waitFor('document.querySelector("h1")?.textContent === "Saved items" && document.querySelector("main article button")?.getAttribute("aria-pressed") === "true"');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await evaluate('document.querySelector("main article button").click()');
  await waitFor('document.querySelector("main").textContent.includes("No saved items yet")');
  await evaluate('document.querySelector(\'a[href="#catalogue"]\').click()');
  await command('Page.reload');
  await waitFor('document.querySelector("h1")?.textContent === "Reviewed catalogue" && !document.querySelector("main [role=status]")');
  assert.ok(responses.some(r => new URL(r.url).pathname === '/api/catalogue' && r.status === 200));
  assert.deepEqual(responses.filter(r => r.status >= 400), []);
  assert.deepEqual(errors, []);
  console.log(`Production Chrome smoke passed: ${live.listings} Daraz listings, ${live.catalogue} catalogue identities; live API/CORS, search/source filter, saves/reload/removal, catalogue reload and mobile layout.`);
} finally {
  socket?.close(); chrome.kill();
  await delay(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}