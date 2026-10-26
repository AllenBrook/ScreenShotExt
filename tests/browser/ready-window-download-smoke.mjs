// Loads the built dist/ as an unpacked MV3 extension and proves the
// 「截图已就绪」 / captureReady completion window starts a Files-settings
// save by itself — no PNG click. The v2.5.2.1 bug was that auto-save ran
// only for result === 'download', while Express / After-capture default is
// `editor`, so this window appeared and nothing landed on disk.
//
// This is a real Chrome-for-Testing + chrome.downloads run, not a stubbed
// chrome.* HTTP smoke. Branded Chrome 137+ ignores --load-extension; see
// worker-thumbnail-smoke.mjs. Residual Edge/IDM risk is documented at the
// bottom of this file: Chromium here has no onDeterminingFilename third
// party, so this cannot reproduce IDM renaming.
//
// Run with: pnpm run icons && pnpm run build && pnpm run smoke:ready-download
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDistFresh, loadPuppeteer } from './dist-server.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const CAPTURE_ID = 'ready-auto-save-1';
const TITLE = 'Example Page';
const PAGE_URL = 'https://example.com/docs';
const TEMPLATE = 'screen1/screenshot_{domain}_{title}_{date}_{time}';
const FILENAME_RE = /^screen1\/screenshot_example\.com_Example Page_\d{4}-\d{2}-\d{2}_\d{6}\.jpg$/;

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

let stepNo = 0;
function step(message) {
  stepNo += 1;
  console.log(`[${stepNo}] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
  console.log(`    ok: ${message}`);
}

async function makeTinyPngDataUrl() {
  const require = createRequire(import.meta.url);
  const sharp = require(join(ROOT, 'node_modules', 'sharp'));
  const png = await sharp({
    create: { width: 8, height: 6, channels: 3, background: { r: 32, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function waitUntil(fn, timeoutMs, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function listFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function seedCaptureAndOpenReady(dataUrl, captureId, title, pageUrl, template, keepWindow) {
  await chrome.storage.local.set({
    'openscreenshot:settings': {
      filenameTemplate: template,
      defaultFormat: 'jpeg',
      keepCompletionWindowAfterDownload: keepWindow,
      captureAction: 'editor',
    },
    'openscreenshot:captures': [
      {
        id: captureId,
        thumbnail: dataUrl,
        width: 8,
        height: 6,
        mode: 'visible',
        title,
        url: pageUrl,
        capturedAt: Date.now(),
        imageBytes: dataUrl.length,
      },
    ],
    [`openscreenshot:capture-image:${captureId}`]: dataUrl,
  });
  const url = chrome.runtime.getURL('src/progress/index.html');
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: 360,
    height: 320,
    focused: true,
  });
  return { url, windowId: win?.id ?? null, captureId };
}

async function sendReadyState(captureId) {
  await chrome.runtime.sendMessage({
    type: 'CAPTURE_WINDOW_PROGRESS',
    percent: 100,
    result: 'editor',
    captureId,
    keepAfterDownload: true,
  });
}

async function searchDownloads() {
  return chrome.downloads.search({
    filenameRegex: 'screenshot_example\\.com_Example Page_.*\\.jpg',
  });
}

async function main() {
  const { sourceCount } = await assertDistFresh(ROOT);
  console.log(
    `dist/ is present and newer than all ${sourceCount} files under src/, public/ and manifest.json`,
  );

  const chromePath = await resolveChrome();
  const puppeteer = await loadPuppeteer(ROOT);
  const work = await mkdtemp(join(tmpdir(), 'oss-ready-download-'));
  const downloadDir = join(work, 'downloads');
  const userDataDir = join(work, 'profile');
  await mkdir(downloadDir, { recursive: true });
  await mkdir(join(userDataDir, 'Default'), { recursive: true });
  await writeFile(
    join(userDataDir, 'Default', 'Preferences'),
    JSON.stringify({
      download: {
        default_directory: downloadDir,
        prompt_for_download: false,
        directory_upgrade: true,
      },
      savefile: { default_directory: downloadDir },
      profile: { default_content_setting_values: { automatic_downloads: 1 } },
    }),
  );

  let browser = null;
  try {
    step(`launching unpacked dist/ on Chrome for Testing (${chromePath})`);
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      userDataDir,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        '--disable-features=DisableLoadExtensionCommandLineSwitch',
        '--lang=zh-CN',
      ],
    });

    const cdp = await browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
    });

    step('finding the extension service worker');
    const sw = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      { timeout: 20000 },
    );
    const worker = await sw.worker();
    assert(!!worker, `service worker target found: ${sw.url()}`);

    const tinyPng = await makeTinyPngDataUrl();
    step('seeding a capture and opening the completion window (editor / 截图已就绪)');
    const opened = await worker.evaluate(
      seedCaptureAndOpenReady,
      tinyPng,
      CAPTURE_ID,
      TITLE,
      PAGE_URL,
      TEMPLATE,
      true,
    );
    assert(opened.captureId === CAPTURE_ID, `seeded capture ${opened.captureId}`);

    let progressPage = null;
    try {
      const progressTarget = await browser.waitForTarget(
        (t) => t.type() === 'page' && t.url().includes('src/progress/index.html'),
        { timeout: 8000 },
      );
      progressPage = await progressTarget.page();
    } catch {
      const origin = new URL(sw.url()).origin;
      progressPage = await browser.newPage();
      await progressPage.goto(`${origin}/src/progress/index.html`);
    }
    assert(!!progressPage, `completion page opened: ${progressPage.url()}`);
    await progressPage.waitForSelector('#status', { timeout: 10000 });

    step('sending CAPTURE_WINDOW_PROGRESS result=editor (same payload as Express finish)');
    await waitUntil(
      async () => {
        await worker.evaluate(sendReadyState, CAPTURE_ID);
        const text = await progressPage.$eval('#status', (el) => el.textContent || '');
        return text.includes('截图已就绪') || text.includes('Screenshot ready') ? text : null;
      },
      10000,
      '截图已就绪 / Screenshot ready',
    );
    const readyText = await progressPage.$eval('#status', (el) => el.textContent || '');
    assert(
      readyText.includes('截图已就绪') || readyText.includes('Screenshot ready'),
      `completion heading is ready-state, not a PNG click: "${readyText}"`,
    );
    const pngClicked = await progressPage.$eval('#png', (el) => el.dataset.clicked === 'true');
    assert(!pngClicked, 'PNG button was not clicked');

    await progressPage.screenshot({
      path: join(work, 'ready-window.png'),
      type: 'png',
    });

    step('waiting for chrome.downloads to complete a JPEG named from the Files template');
    const items = await waitUntil(
      async () => {
        const found = await worker.evaluate(searchDownloads);
        const matched = (found || []).filter((item) => {
          const normalized = String(item.filename || '').replace(/\\/g, '/');
          return (
            item.state === 'complete' &&
            /screenshot_example\.com_Example Page_\d{4}-\d{2}-\d{2}_\d{6}\.jpg$/.test(normalized)
          );
        });
        return matched.length ? matched : null;
      },
      20000,
      'completed JPEG download',
    );
    const reported = items[0].filename;
    console.log(`    chrome.downloads filename: ${reported}`);
    assert(
      /screenshot_example\.com_Example Page_\d{4}-\d{2}-\d{2}_\d{6}\.jpg$/.test(
        reported.replace(/\\/g, '/'),
      ),
      'reported name uses the Files template and JPEG from defaultFormat (not a PNG-button .png)',
    );

    step('confirming the file exists on disk under the Downloads directory');
    const onDisk = await waitUntil(
      async () => {
        const files = await listFiles(downloadDir);
        return (
          files.find((f) =>
            /screenshot_example\.com_Example Page_\d{4}-\d{2}-\d{2}_\d{6}\.jpg$/.test(f),
          ) || null
        );
      },
      10000,
      `a JPEG under ${downloadDir}`,
    );
    assert(existsSync(onDisk), `on-disk file exists: ${onDisk}`);
    const relative = onDisk.slice(downloadDir.length).replace(/\\/g, '/').replace(/^\//, '');
    assert(
      FILENAME_RE.test(relative),
      `on-disk relative path matches template folders: ${relative}`,
    );

    assert(!progressPage.isClosed(), '通用 ON: completion window stayed open after auto-save');

    const evidenceDir = join(tmpdir(), 'oss-ready-download-evidence');
    await mkdir(evidenceDir, { recursive: true });
    const evidenceFile = join(evidenceDir, relative.replaceAll('/', '_'));
    await copyFile(onDisk, evidenceFile);
    await copyFile(join(work, 'ready-window.png'), join(evidenceDir, 'ready-window.png')).catch(
      () => {},
    );
    await progressPage.close().catch(() => {});

    step('通用 OFF: a second ready window must auto-save then close');
    const closeId = `${CAPTURE_ID}-close`;
    const closeTitle = 'Close Test';
    await worker.evaluate(
      seedCaptureAndOpenReady,
      tinyPng,
      closeId,
      closeTitle,
      PAGE_URL,
      TEMPLATE,
      false,
    );
    const closeTarget = await browser
      .waitForTarget((t) => t.type() === 'page' && t.url().includes('src/progress/index.html'), {
        timeout: 15000,
      })
      .catch(() => null);
    let closePage = closeTarget ? await closeTarget.page() : null;
    if (!closePage) {
      const origin = new URL(sw.url()).origin;
      closePage = await browser.newPage();
      await closePage.goto(`${origin}/src/progress/index.html`);
    }
    await closePage.waitForSelector('#status', { timeout: 10000 });
    await waitUntil(
      async () => {
        await worker.evaluate(sendReadyState, closeId);
        const text = await closePage.$eval('#status', (el) => el.textContent || '').catch(() => '');
        return text.includes('截图已就绪') ||
          text.includes('Screenshot ready') ||
          text.includes('正在开始下载') ||
          text.includes('download is starting')
          ? text
          : closePage.isClosed()
            ? 'closed'
            : null;
      },
      10000,
      'second ready window',
    );

    const closeOnDisk = await waitUntil(
      async () => {
        const files = await listFiles(downloadDir);
        return (
          files.find((f) =>
            /screenshot_example\.com_Close Test_\d{4}-\d{2}-\d{2}_\d{6}\.jpg$/.test(f),
          ) || null
        );
      },
      20000,
      'JPEG for the 通用-off capture',
    );
    assert(existsSync(closeOnDisk), `通用 OFF still wrote a file: ${closeOnDisk}`);

    await waitUntil(
      async () => (closePage.isClosed() ? true : null),
      10000,
      'completion window to close after download (通用 OFF)',
    );
    assert(closePage.isClosed(), '通用 OFF: completion window closed after download completed');

    console.log('\nReady-window auto-download smoke passed.');
    console.log(`On-disk save (通用 ON): ${onDisk}`);
    console.log(`On-disk save (通用 OFF): ${closeOnDisk}`);
    console.log(`Copied evidence: ${evidenceFile}`);
    console.log(`chrome.downloads: ${reported}`);
    console.log(
      'Residual Edge risk: this Chromium has no third-party onDeterminingFilename (IDM). ' +
        'The SW filename guard still re-suggests the template there. If IDM still drops ' +
        'the name after this path, that is Edge-only; the ready window now uses the same ' +
        'CAPTURE_QUICK_ACTION save API as the PNG button, with Files defaultFormat.',
    );
  } finally {
    if (browser) await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\nReady-window download smoke FAILED: ${err.message}`);
  console.error(
    'Install Chrome for Testing if needed: npx @puppeteer/browsers install chrome@stable\n' +
      'Branded Chrome 137+ ignores --load-extension; do not fall back to /opt/google/chrome.',
  );
  process.exitCode = 1;
});
