class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const httpError = (status, message) => new HttpError(status, message);

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function numberParam(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = true, cap = false } = {}) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, 'Invalid numeric parameter');
  const number = Number(value);
  if (!Number.isFinite(number) || (integer && !Number.isSafeInteger(number)) || number < min || (!cap && number > max)) {
    throw httpError(400, 'Invalid numeric parameter');
  }
  return Math.min(number, max);
}

function textParam(value, maxLength = 200) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) throw httpError(400, 'Invalid text parameter');
  return value.trim();
}

function pagination(query, fallback = 20) {
  return {
    limit: numberParam(query.limit, fallback, { min: 1, max: 100, cap: true }),
    offset: numberParam(query.offset, 0, { max: 1000000 })
  };
}

module.exports = { HttpError, httpError, asyncRoute, numberParam, textParam, pagination };