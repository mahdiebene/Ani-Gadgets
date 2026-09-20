const fs = require('node:fs');
const { Pool, types } = require('pg');

// Prices/ratings are bounded numeric columns. Keep bigint IDs as strings.
types.setTypeParser(1700, Number);

function createPool(env = process.env) {
  const password = env.PGPASSWORD_FILE ? fs.readFileSync(env.PGPASSWORD_FILE, 'utf8').trim() : env.PGPASSWORD;
  if (!env.DATABASE_URL && (!env.PGHOST || !env.PGUSER || !env.PGDATABASE || !password)) {
    throw new Error('Configure DATABASE_URL or PGHOST/PGUSER/PGDATABASE and a PostgreSQL password file.');
  }
  const pool = new Pool({
    ...(env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {
      host: env.PGHOST, port: Number(env.PGPORT || 5432), user: env.PGUSER, database: env.PGDATABASE, password
    }),
    max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    statement_timeout: 5000, query_timeout: 7000, application_name: 'anigadgets'
  });
  pool.on('error', error => console.error('PostgreSQL pool error:', error.code || 'connection failure'));
  return pool;
}
module.exports = { createPool };