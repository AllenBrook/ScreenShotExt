// Loads dist/ unpacked in Chrome for Testing and proves capture-full-page
// received its manifest suggested_key. Ctrl+G stays empty because Chromium
// reserves it for Find next; Alt+Shift+G is the combo this build ships.
//
// Run with: pnpm run icons && pnpm run build && pnpm run smoke:commands
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDistFresh, loadPuppeteer } from './dist-server.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST = join(ROOT, 'dist');

async function findChromeBins(root, relativeBins) {
  const found = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const relative of relativeBins) {
      const bin = join(root, entry.name, relative);
      if (existsSync(bin)) found.push(bin);
    }
  }
  return found;
}

function versionOf(bin) {
  const out = execFileSync(bin, ['--version'], { encoding: 'utf8' });
  const match = out.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0, 0];
}

function newerVersion(a, b) {
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? a : b;
  }
  return a;
}

async function resolveChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const relativeBins = [
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
    'chrome-headless-shell-linux64/chrome-headless-shell',
    join(
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ),
    join(
      'chrome-mac-x64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ),
  ];
  const candidates = [
    ...(await findChromeBins(join(ROOT, 'mcp', 'chrome'), relativeBins)),
    ...(await findChromeBins(join(ROOT, 'chrome'), relativeBins)),
    ...(await findChromeBins(join(homedir(), '.cache', 'puppeteer', 'chrome'), relativeBins)),
    ...(await findChromeBins(join(homedir(), '.cache', 'ms-playwright'), relativeBins)),
    ...(await findChromeBins(join(homedir(), 'Library', 'Caches', 'ms-playwright'), relativeBins)),
  ];
  if (candidates.length === 0) {
    throw new Error(
      'no Chrome for Testing found; run: npx @puppeteer/browsers install chrome@stable',
    );
  }
  let best = candidates[0];
  let bestVersion = versionOf(best);
  for (const bin of candidates.slice(1)) {
    const version = versionOf(bin);
    if (newerVersion(version, bestVersion) === version && version !== bestVersion) {
      best = bin;
      bestVersion = version;
    }
  }
  return best;
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
  console.log(`    ok: ${message}`);
}

async function main() {
  await assertDistFresh(ROOT);
  const chrome = await resolveChrome();
  const puppeteer = await loadPuppeteer(ROOT);
  const work = await mkdtemp(join(tmpdir(), 'oss-commands-smoke-'));
  let browser = null;
  try {
    console.log(`[1] launching unpacked dist/ on Chrome for Testing (${chrome})`);
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      userDataDir: join(work, 'profile'),
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        '--disable-features=DisableLoadExtensionCommandLineSwitch',
      ],
    });
    const sw = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      { timeout: 20000 },
    );
    const worker = await sw.worker();
    const commands = await worker.evaluate(async () => chrome.commands.getAll());
    const byName = Object.fromEntries(commands.map((c) => [c.name, c]));
    console.log('[2] chrome.commands.getAll()', JSON.stringify(byName, null, 2));

    const full = byName['capture-full-page'];
    assert(!!full, 'capture-full-page is registered');
    assert(
      full.shortcut === 'Alt+Shift+G',
      `capture-full-page auto-bound Alt+Shift+G (got ${JSON.stringify(full.shortcut)})`,
    );
    assert(full.shortcut !== '', 'capture-full-page is not the empty 未设置 state Ctrl+G produced');
    assert(
      byName['capture-visible']?.shortcut === 'Alt+Shift+V',
      `visible still auto-binds Alt+Shift+V (got ${JSON.stringify(byName['capture-visible']?.shortcut)})`,
    );
    assert(
      byName['capture-region']?.shortcut === 'Ctrl+Shift+E',
      `region still auto-binds Ctrl+Shift+E (got ${JSON.stringify(byName['capture-region']?.shortcut)})`,
    );

    console.log('\nCommands shortcut smoke passed.');
  } finally {
    if (browser) await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\nCommands shortcut smoke FAILED: ${err.message}`);
  process.exitCode = 1;
});
