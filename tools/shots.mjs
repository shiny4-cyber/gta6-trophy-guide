// Takes the four screenshots of app/ in headless Chrome over the DevTools protocol: no browser tooling to
// install, one static server, real clicks on the app's own controls. Run it where Chrome exists:
//   node tools/shots.mjs            (writes screenshots/*.jpg)
// It reads app/, serves it on 127.0.0.1, and never touches the network.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { extname, join, resolve, normalize, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const APP = join(ROOT, 'app');
const OUT = join(ROOT, 'screenshots');
const PORT = 8137;
const CDP_PORT = 9337;
const PROFILE = '/tmp/leonida-chrome';
const W = 1280;
const H = 900;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'
};

/* ---------- static server ---------- */

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(APP, normalize(path)));
  if (file !== APP && !file.startsWith(APP + sep)) { res.writeHead(403).end('no'); return; }
  let body;
  try { body = readFileSync(file); } catch { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
});

/* ---------- cdp ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome did not open a debugging port');
}

function client(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const waiting = new Map();
  const events = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, fail } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? fail(new Error(JSON.stringify(msg.error))) : ok(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  const ready = new Promise((ok, fail) => {
    ws.addEventListener('open', () => ok());
    ws.addEventListener('error', () => fail(new Error('ws error')));
  });
  return {
    ready,
    send(method, params = {}) {
      const n = ++id;
      return new Promise((ok, fail) => {
        waiting.set(n, { ok, fail });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
    close() { try { ws.close(); } catch { /* gone */ } }
  };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ' ' + JSON.stringify(res.exceptionDetails.exception?.description || ''));
  return res.result?.value;
}

async function shot(cdp, name, quality = 84) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
  const bytes = Buffer.from(res.data, 'base64');
  writeFileSync(join(OUT, name), bytes);
  console.log(name, bytes.length, 'bytes');
  return bytes.length;
}

/* ---------- states ---------- */

// 19 earned, mixed grades, one missable left unearned, spoiler off: the working screen.
const PROGRESS = [2, 3, 8, 9, 4, 5, 6, 7, 10, 11, 12, 13, 21, 19, 23, 24, 45, 46, 47];

async function setState(cdp, { ids, spoiler }) {
  const payload = JSON.stringify({ schema: 'leonida-legend/tracker', version: 1, spoiler, ids });
  await evaluate(cdp, `localStorage.setItem('leonida-legend.v1', ${JSON.stringify(payload)}); location.reload(); 1`);
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const n = await evaluate(cdp, `document.querySelectorAll('.card').length`);
    if (n > 0) return;
  }
  throw new Error('the list never rendered');
}

async function click(cdp, selector, index = 0) {
  const ok = await evaluate(cdp, `(() => { const els = document.querySelectorAll(${JSON.stringify(selector)}); const el = els[${index}]; if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error('nothing to click: ' + selector);
  await sleep(320);
}

async function pickTrophy(cdp, id) {
  const ok = await evaluate(cdp, `(() => { const el = document.querySelector('.card[data-id="${id}"]'); if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error('no card for ' + id);
  await sleep(280);
}

/* ---------- main ---------- */

async function main() {
  if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok));

  const chrome = spawn('google-chrome', [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,BackForwardCache', '--font-render-hinting=none',
    `http://127.0.0.1:${PORT}/`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => { chromeErr += d.toString(); });

  try {
    const ws = await connect();
    const cdp = client(ws);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Emulation.setScrollbarsHidden', { hidden: true });

    // 1. the working screen: checklist with a missable trophy's cited guide open
    await setState(cdp, { ids: PROGRESS, spoiler: false });
    await pickTrophy(cdp, 28);
    await evaluate(cdp, 'window.scrollTo(0, 366); 1');
    await sleep(260);
    await shot(cdp, '1-checklist-and-guide.jpg');

    // 2. the roadmap, with progress on the stages
    await click(cdp, '.tab[data-view="roadmap"]');
    await evaluate(cdp, 'window.scrollTo(0, 210); 1');
    await sleep(240);
    await shot(cdp, '2-roadmap.jpg');

    // 3. the spoiler shield on, against a story trophy
    await setState(cdp, { ids: PROGRESS, spoiler: true });
    await pickTrophy(cdp, 4);
    await evaluate(cdp, 'window.scrollTo(0, 366); 1');
    await sleep(260);
    await shot(cdp, '3-spoiler-shield.jpg');

    // 4. export and import, with the exported file shown
    await click(cdp, '.tab[data-view="transfer"]');
    await click(cdp, '#export-copy');
    await evaluate(cdp, 'window.scrollTo(0, 300); 1');
    await sleep(250);
    await shot(cdp, '4-export-import.jpg');

    cdp.close();
  } finally {
    chrome.kill('SIGTERM');
    server.close();
    if (chromeErr && chromeErr.trim()) console.log('chrome said:', chromeErr.trim().split('\n').slice(-3).join(' | '));
  }
  console.log('done');
}

main().catch((err) => { console.error('FAILED', err.message); process.exit(1); });
