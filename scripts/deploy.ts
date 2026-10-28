// Deploys the committed tree to the server (relay first, then the site), checking each is live.
// Settings come from the environment or a git-ignored .env file (see .env.example):
//   DEPLOY_TARGET     rsync destination for dist/, e.g. <user>@<server>:<web-root>/
//   SITE_URL          the site's public address, e.g. https://<domain>/
//   DEPLOY_RELAY_DIR  folder on the server for the relay bundle and its service file
//   RELAY_*           optional relay settings, passed to the service (relay/config.ts)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { KEYS } from '../relay/config.ts';
import { NEW_ROOM, RELAY_PATH, RelayMsg, relayUrl } from '../relay/protocol.ts';
import { CONNECT_TIMEOUT_MS } from '../src/games/turbo-tumble/net.ts';

const RELAY_SERVICE = 'linhe-relay'; // the systemd unit's name
const CHECK_GAME = 'deploy-check';   // the live relay check creates (and leaves) a room for this game name
const CHECK_TRIES = 5;               // the restarted relay may need a moment before it listens
const CI_WORKFLOW = 'ci.yml';        // .github/workflows: all three browsers (Firefox can't run on every Mac)
const CI_WAIT_MS = 25 * 60_000;     // longer than the CI job's own 20-minute cap
const CI_START_MS = 3 * 60_000;     // a pushed commit's run appears well within this
const CI_POLL_MS = 30_000;          // ~50 polls at most, inside GitHub's 60 anonymous requests an hour
const q = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`; // quote for the remote shell

function fail(message: string): never {
  console.error(`deploy: ${message}`);
  process.exit(1);
}
const run = (cmd: string, ...args: string[]) => execFileSync(cmd, args, { stdio: 'inherit' });
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** The GitHub repository CI runs in (origin), after checking this commit is on origin (fails fast, before slow steps). */
function pushedRepo() {
  const origin = git('remote', 'get-url', 'origin');
  const repo = /^(?:git@github\.com:|ssh:\/\/git@(?:ssh\.)?github\.com(?::\d+)?\/|https:\/\/(?:[^@/]+@)?github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(origin)?.[1];
  if (!repo) fail('origin must be a GitHub repository (CI results come from GitHub Actions)');
  if (!git('branch', '--remotes', '--contains', 'HEAD', '--format=%(refname:short)').split('\n').some(b => b.startsWith('origin/')))
    fail('push this commit to origin first, so CI can test it');
  return repo;
}

type Runs = { workflow_runs?: { status: string; conclusion: string | null; html_url: string }[] };

/** Waits for the push-triggered CI run on this exact commit (GitHub's public API; the repo is public). */
async function ciPassed(repo: string, sha: string) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${CI_WORKFLOW}/runs?head_sha=${sha}&event=push`;
  const started = Date.now();
  let seen = false; // a run has appeared at least once: later errors are only retried
  for (;; await new Promise(r => setTimeout(r, CI_POLL_MS))) {
    let state: string, runs: Runs['workflow_runs'];
    try {
      const res = await fetch(url, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
      state = res.ok ? 'not started' : `GitHub HTTP ${res.status}`;
      if (res.ok) runs = ((await res.json()) as Runs).workflow_runs ?? [];
    } catch (err) {
      state = `GitHub unreachable (${(err as Error).name})`;
    }
    const latest = runs?.[0];
    seen ||= !!latest;
    if (latest?.status === 'completed') {
      if (latest.conclusion === 'success') return console.log(`deploy: CI passed for ${sha.slice(0, 7)}`);
      fail(`CI ${latest.conclusion} for ${sha.slice(0, 7)}: ${latest.html_url}`);
    }
    const waited = Date.now() - started;
    if (!seen && waited > CI_START_MS) fail(runs // GitHub only runs CI on the newest commit of each push
      ? `no CI run for ${sha.slice(0, 7)}: deploy the newest pushed commit (or push again to run CI)`
      : `can't read CI results for ${sha.slice(0, 7)}: ${state}`);
    if (waited > CI_WAIT_MS) fail(`CI didn't finish within ${CI_WAIT_MS / 60_000} minutes for ${sha.slice(0, 7)}`);
    console.log(`deploy: waiting for CI on ${sha.slice(0, 7)} (${latest?.status ?? state})…`); // errors are retried
  }
}

const target = process.env.DEPLOY_TARGET;
if (!target || !process.env.SITE_URL) fail('set DEPLOY_TARGET and SITE_URL (copy .env.example to .env)');
const site = URL.parse(process.env.SITE_URL);
// the site root only (asset paths are root-relative), and no credentials (fetch refuses them)
if (!site || !/^https?:$/.test(site.protocol) || site.pathname !== '/' || site.search || site.hash || site.username || site.password)
  fail('SITE_URL must be a plain http(s) site root, e.g. https://<domain>/');
const relayDir = posix.normalize(process.env.DEPLOY_RELAY_DIR ?? '').replace(/\/+$/, ''); // "/srv/../home" can't sneak by
// plain path characters only (nothing a shell or systemd would expand); the service runs with ProtectHome
// and PrivateTmp, so it can't see /home, /root, /run/user, /tmp or /var/tmp
if (!/^\/[\w./-]+$/.test(relayDir) || /^\/(home|root|run\/user|tmp|var\/tmp)(\/|$)/.test(relayDir))
  fail('set DEPLOY_RELAY_DIR to an absolute folder of plain characters, outside /home, /root, /run/user, /tmp and /var/tmp');
// <user>@<server>:/<web-root>/: no option-like user or host ("-x"), no rsync-daemon "::" or rsync:// form
const server = /^([\w.][\w.-]*@)?[\w.][\w.-]*(?=:\/(?!\/))/.exec(target)?.[0];
if (!server) fail('DEPLOY_TARGET must look like <user>@<server>:/<web-root>/');

if (git('status', '--porcelain')) fail('commit or stash changes before deploying');
const repo = pushedRepo();
run('yarn', 'install', '--immutable'); // exactly what yarn.lock says
run('yarn', 'test');
run('yarn', 'build');
run('yarn', 'e2e:local'); // browser tests here (Chromium, WebKit); CI runs all three engines
await ciPassed(repo, git('rev-parse', 'HEAD'));
run('yarn', 'build:relay');
run('chmod', '-R', 'u=rwX,go=rX', 'dist', 'dist-relay');
const rsync = ['-az', '--no-o', '--no-g'];

// 1. the relay: bundle and service file side by side in DEPLOY_RELAY_DIR, linked into systemd. It goes
//    first, so a relay that won't start stops the deploy before the new site (which needs it) goes live.
// node must be on systemd's own search path (the unit runs `node`, not a login shell's PATH)
run('ssh', server, `PATH=$(systemd-path search-binaries-default) command -v node >/dev/null || ` +
  `{ echo "node is not on systemd's search path on the server"; exit 1; }; ` +
  // umask 022: the service's own (dynamic) user must be able to read every folder mkdir creates
  `(umask 022; mkdir -p ${q(relayDir)}) || exit 1; ` +
  // a symlink into a hidden folder would pass the checks above but leave the service unable to read the bundle;
  // checked before chmod, so a symlinked folder's real target is never touched
  `[ "$(realpath ${q(relayDir)})" = ${q(relayDir)} ] || { echo "DEPLOY_RELAY_DIR must not go through a symlink"; exit 1; }; ` +
  `chmod 755 ${q(relayDir)}`);
// only known relay settings with whole-number values reach the unit file (no stray directives)
const settings = Object.values(KEYS).filter(k => /^\d+$/.test(process.env[k] ?? '')).map(k => `Environment=${k}=${process.env[k]}`);
const unit = [
  '[Unit]', 'Description=linhe.me game relay', 'After=network.target', '',
  '[Service]',
  `ExecStart=node ${relayDir}/relay.mjs`, // systemd finds node on its own search path
  'DynamicUser=yes', 'NoNewPrivileges=yes', 'ProtectSystem=strict', 'ProtectHome=yes', 'PrivateTmp=yes',
  'MemoryMax=256M', 'Restart=always', 'RestartSec=2', ...settings, '',
  '[Install]', 'WantedBy=multi-user.target', '',
].join('\n');
run('rsync', ...rsync, 'dist-relay/relay.mjs', `${server}:${relayDir}/`);
execFileSync('ssh', [server, `cat > ${q(`${relayDir}/${RELAY_SERVICE}.service`)}`], { input: unit, stdio: ['pipe', 'inherit', 'inherit'] });
run('ssh', server, `systemctl link ${q(`${relayDir}/${RELAY_SERVICE}.service`)} && systemctl daemon-reload && ` +
  `systemctl enable ${RELAY_SERVICE} && systemctl restart ${RELAY_SERVICE}`);

const relayBase = new URL(RELAY_PATH, site).toString();
const checkRelay = () => new Promise<string>(resolve => {
  const ws = new WebSocket(relayUrl(relayBase, CHECK_GAME, NEW_ROOM));
  const timer = setTimeout(() => { ws.close(); resolve(`no answer within ${CONNECT_TIMEOUT_MS / 1000} s`); }, CONNECT_TIMEOUT_MS);
  ws.onmessage = e => {
    clearTimeout(timer);
    ws.close();
    let hello: { t?: unknown; code?: unknown } | null = null;
    try { hello = JSON.parse(String(e.data)); } catch {}
    resolve(hello?.t === RelayMsg.Hello && hello.code ? '' : 'unexpected first message');
  };
  ws.onclose = e => { clearTimeout(timer); resolve(`closed with code ${e.code}`); };
});
let relayCheck = '';
for (let attempt = 1; attempt <= CHECK_TRIES; attempt++) {
  relayCheck = await checkRelay();
  if (!relayCheck) break;
  await new Promise(r => setTimeout(r, 1000));
}
if (relayCheck) fail(`relay at ${relayBase}: ${relayCheck} (after ${CHECK_TRIES} tries; see journalctl -u ${RELAY_SERVICE})`);
console.log(`deploy: the relay at ${relayBase} answers`);

// 2. the site. pass 1: everything except the page; pass 2: the page last, so an interrupted deploy leaves
//    the old page and everything it needs live. Nothing is ever deleted: old assets stay for visitors with an
//    older page open, and a mistyped DEPLOY_TARGET can't wipe anything.
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
