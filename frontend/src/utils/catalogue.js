export function money(amount, currency = 'BDT') {
  if (amount == null || !Number.isFinite(Number(amount))) return 'Unknown';
  try { return new Intl.NumberFormat('en-BD', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount)); }
  catch { return `${amount} ${currency}`; }
}

export function estimateBdt(amounts, rate, rateDate) {
  const date = Date.parse(rateDate);
  if (!Number.isFinite(date) || date > Date.now() || !Number.isFinite(Number(rate)) || Number(rate) <= 0) return null;
  if (amounts.length !== 4 || amounts.some(n => n == null || n === '' || !Number.isFinite(Number(n)) || Number(n) < 0)) return null;
  const total = amounts.reduce((sum, n) => sum + Number(n), 0) * Number(rate);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
}

export function lowestTotal(offers) {
  const values = offers.filter(o => o.fresh && Date.parse(o.expires_at) > Date.now() && Number.isFinite(o.landed_total)).map(o => o.landed_total);
  return values.length ? Math.min(...values) : null;
}

const sessionTargets = new Map();
export function readTarget(id, storage) {
  if (sessionTargets.has(id)) return sessionTargets.get(id);
  try { const n = Number((storage ?? globalThis.localStorage).getItem(`anigadgets:target:${id}`)); return n > 0 && Number.isFinite(n) ? String(n) : ''; }
  catch { return ''; }
}

export function saveTarget(id, value, storage) {
  if (value && (!Number.isFinite(Number(value)) || Number(value) <= 0)) return false;
  try {
    storage ??= globalThis.localStorage;
    if (!value) storage.removeItem(`anigadgets:target:${id}`);
    else if (Number.isFinite(Number(value)) && Number(value) > 0) storage.setItem(`anigadgets:target:${id}`, value);
    else return false;
    sessionTargets.delete(id);
    return true;
  } catch { sessionTargets.set(id, value); return false; }
}