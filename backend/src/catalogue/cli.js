require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { validateDocument } = require('./validation');
const { importDocument } = require('./import');
const { createDemo } = require('./demo');
const { createPool } = require('../db/pool');

async function main(args = process.argv.slice(2)) {
  const flags = new Set(['--file', '--demo', '--print-demo', '--apply', '--dry-run']);
  let filename;
  for (let i = 0; i < args.length; i++) {
    if (!flags.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
    if (args[i] === '--file') { filename = args[++i]; if (!filename || filename.startsWith('--')) throw new Error('--file needs a filename'); }
  }
  if (args.includes('--print-demo')) { console.log(JSON.stringify(createDemo(), null, 2)); return; }
  if (Boolean(filename) === args.includes('--demo')) throw new Error('Use --file <absolute JSON path> OR --demo. Default: validation only. Add --apply to write.');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose --apply or --dry-run');
  if (filename && !path.isAbsolute(filename)) throw new Error('--file must be an absolute path');
  if (filename && fs.statSync(filename).size > 2 * 1024 * 1024) throw new Error('File exceeds 2 MiB');
  const doc = validateDocument(filename ? JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '')) : createDemo());
  if (!args.includes('--apply')) {
    console.log('Validation passed; no database connection, URL fetch or write. References/conflicts are checked transactionally on apply.');
    console.log(Object.fromEntries(['products', 'merchants', 'offers', 'observations', 'evidence'].map(key => [key, doc[key].length])));
    return;
  }
  if (doc.products.some(p => p.is_demo) && process.env.CATALOGUE_ALLOW_DEMO !== '1') throw new Error('Demo writes require CATALOGUE_ALLOW_DEMO=1; use a disposable local database');
  const pool = createPool();
  try { console.log('Applied:', await importDocument(pool, doc)); } finally { await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };