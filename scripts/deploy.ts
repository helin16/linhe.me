// Deploys the committed tree to the server, then checks the live site serves the new build.
// Settings come from the environment or a git-ignored .env file (see .env.example):
//   DEPLOY_TARGET  rsync destination for dist/, e.g. root@<server>:/srv/linhe.me/
//   SITE_URL       the site's public address, e.g. https://<domain>/
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function fail(message: string): never {
  console.error(`deploy: ${message}`);
  process.exit(1);
}
const run = (cmd: string, ...args: string[]) => execFileSync(cmd, args, { stdio: 'inherit' });

const target = process.env.DEPLOY_TARGET;
if (!target || !process.env.SITE_URL) fail('set DEPLOY_TARGET and SITE_URL (copy .env.example to .env)');
const site = URL.parse(process.env.SITE_URL);
// the site root only (asset paths are root-relative), and no credentials (fetch refuses them)
if (!site || !/^https?:$/.test(site.protocol) || site.pathname !== '/' || site.search || site.hash || site.username || site.password)
  fail('SITE_URL must be a plain http(s) site root, e.g. https://<domain>/');

if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })) fail('commit or stash changes before deploying');
run('yarn', 'install', '--immutable'); // exactly what yarn.lock says
run('yarn', 'test');
run('yarn', 'build');
run('chmod', '-R', 'u=rwX,go=rX', 'dist');
// pass 1: everything except the page; pass 2: the page last, so an interrupted deploy leaves the old
// page and everything it needs live. Nothing is ever deleted: old assets stay for visitors with an
// older page open, and a mistyped DEPLOY_TARGET can't wipe anything.
const rsync = ['-az', '--no-o', '--no-g'];
run('rsync', ...rsync, '--exclude', '/index.html', 'dist/', target);
run('rsync', ...rsync, 'dist/index.html', target);

// every page path returns the app with 200, so check the live page names the new build's entry
// assets, and every file in the build's assets/ (lazy game chunks included) is served as itself
const get = (url: URL, method = 'GET') => fetch(url, { method, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
function why(err: unknown) {
  const cause = (err as { cause?: { code?: string; message?: string } } | null)?.cause;
  const code = cause?.message?.includes(cause.code ?? '') ? '' : cause?.code; // system errors repeat the code
  return [code, cause?.message].filter(Boolean).join(': ') || (err as Error)?.message || String(err);
}

const page = await get(site).catch(err => fail(`${site}: ${why(err)}`));
if (!page.ok) fail(`${site}: HTTP ${page.status}`);
const live = await page.text().catch(err => fail(`${site}: ${why(err)}`));
const entry = [...new Set(readFileSync('dist/index.html', 'utf8').match(/\/assets\/[^"'\s)<>]+/g) ?? [])];
const stale = entry.filter(a => !live.includes(a));
if (!entry.length || stale.length) fail(`${site} isn't serving the new build (missing ${stale.join(', ') || 'assets'})`);

const files = readdirSync('dist/assets', { recursive: true, withFileTypes: true })
  .filter(f => f.isFile())
  .map(f => '/' + relative('dist', join(f.parentPath, f.name)).split(sep).map(encodeURIComponent).join('/'));
const problems = await Promise.all(files.map(async path => {
  try {
    const res = await get(new URL(path, site), 'HEAD');
    if (res.status !== 200) return `${path} (HTTP ${res.status})`;
    if (res.headers.get('content-type')?.toLowerCase().startsWith('text/html')) return `${path} (got the HTML page)`;
  } catch (err) {
    return `${path} (${why(err)})`;
  }
  return '';
}));
const broken = problems.filter(Boolean);
if (broken.length) fail(`assets not served: ${broken.join(', ')}`);
console.log(`deploy: ${site} serves the new build (${files.length} assets checked)`);
