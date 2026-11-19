// gta6-trophy-guide-01 entry: hands the guide in. app/ is the whole product (plain static files, no build step,
// nothing fetched over the network); screenshots/ holds the four renders of it; this program copies both to the
// output directory and writes dossier.json from them with the kit's own library, unchanged, so the gate can build
// the same bytes again and compare.
//
//   node main.ts                              writes /output (inside the grader)
//   MAKEFUN_OUTPUT_DIR=out node main.ts       writes ./out (anywhere else)
//
// The caps passed to buildDossier are the scorer's: 160 KiB of text, 3 or 4 screenshots of at most 256 KiB each,
// at most 993 files and 48 MiB inside app/.

import { cpSync, existsSync, mkdirSync, rmSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const appDir = join(here, 'app');
const shotsDir = join(here, 'screenshots');
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648
};

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

if (!existsSync(join(appDir, 'index.html'))) fail('app/index.html is missing; the guide is app/');
if (!existsSync(shotsDir)) fail('screenshots/ is missing; the entry hands in 3 or 4 renders of the app');
const shots = readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name));
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  fail(`screenshots/ holds ${shots.length} images; the dossier takes 3 or 4`);
}

// A clean copy each run: the gate builds the dossier twice and compares the bytes, so nothing may be left over
// from a previous run inside the two directories this program owns.
mkdirSync(outDir, { recursive: true });
for (const dir of ['app', 'screenshots']) rmSync(join(outDir, dir), { recursive: true, force: true });

cpSync(appDir, join(outDir, 'app'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const appFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else appFiles.push(path);
  }
})(appDir);
const appBytes = appFiles.reduce((sum, path) => sum + statSync(path).size, 0);

console.log(
  `main.ts: wrote ${outDir} - ${dossier.length} bytes of dossier.json, ${shots.length} screenshots, ` +
  `app/ ${appFiles.length} files and ${appBytes} bytes`
);
