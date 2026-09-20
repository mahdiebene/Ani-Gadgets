// Creates and destroys its own loopback-only PostgreSQL cluster. Never uses a supplied DB.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');

async function main() {
  const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\16\\bin' : '');
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'anigadgets-pg-'));
  const data = path.join(temporary, 'data');
  const password = crypto.randomBytes(24).toString('hex');
  const passwordFile = path.join(temporary, 'password'); fs.writeFileSync(passwordFile, password, { mode: 0o600 });
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const env = { ...process.env, DATABASE_URL: '', PGPASSWORD_FILE: '', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGPASSWORD: password, PGDATABASE: 'anigadgets', TEST_DATABASE: '1' };
  const run = (tool, args, options = {}) => {
    const executable = tool === 'node' ? process.execPath : path.join(bin, tool + (process.platform === 'win32' ? '.exe' : ''));
    // pg_ctl's server must not inherit captured pipes (which would never reach EOF).
    const result = spawnSync(executable, args, { cwd: root, env, encoding: 'utf8',
      ...(tool === 'pg_ctl' ? { stdio: 'ignore' } : {}), ...options });
    if (result.stdout) process.stdout.write(result.stdout);
    // psql emits successful reapplication NOTICEs on stderr. Keep this runner's
    // stderr for failures so PowerShell's native-error preference cannot abort cleanup.
    if (result.stderr) process.stdout.write(result.stderr);
    if (result.error || result.status !== 0) throw result.error || new Error(`${tool} exited ${result.status}`);
  };
  let started = false;
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '--pwfile', passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--no-sync']);
    run('pg_ctl', ['-D', data, '-l', path.join(temporary, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']); started = true;
    run('createdb', ['anigadgets']);
    const roles = fs.readFileSync(path.join(root, '../deploy/roles.sql'), 'utf8')
      .replace(/btrim\(pg_read_file\('\/run\/secrets\/db_(reader|writer)_password'\), E'\\r\\n '\)/g, `'${password}'`);
    const rolesFile = path.join(temporary, 'roles.sql'); fs.writeFileSync(rolesFile, roles);
    for (let i = 0; i < 2; i++) {
      run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(root, 'db/schema.sql')]);
      run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', rolesFile]);
    }
    run('node', ['--test']);
    run('node', ['src/catalogue/cli.js', '--demo', '--apply'], { env: { ...env, CATALOGUE_ALLOW_DEMO: '1' } });
    console.log('Disposable PostgreSQL validation and 100-product CLI demo import passed.');
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });