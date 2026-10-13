// Real-browser regression for scrollbar-free tiles and exact pixel placement.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import sharp from 'sharp';
import { loadPuppeteer } from './dist-server.mjs';

const puppeteer = await loadPuppeteer(fileURLToPath(new URL('../../', import.meta.url)));
const source = await readFile(
  new URL('../../src/content/scroll-capture.ts', import.meta.url),
  'utf8',
);
const script = await transform(source, {
  loader: 'ts',
  format: 'iife',
  globalName: 'captureModule',
  target: 'es2022',
});
const geometry = await transform(
  await readFile(new URL('../../src/shared/geometry.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'iife', globalName: 'geometryModule', target: 'es2022' },
);
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  ignoreDefaultArgs: ['--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><style>
    html { scrollbar-gutter: stable; scroll-behavior: smooth !important; }
    body { margin:0; }
    .content { width:1100px;height:1753px;background:repeating-linear-gradient(#112233 0px,#112233 37px,#789abc 37px,#789abc 74px); }
    ::-webkit-scrollbar { width:18px;height:16px; }
    ::-webkit-scrollbar-thumb { background:rgb(255,0,255); }
    ::-webkit-scrollbar-track { background:rgb(0,255,0); }
  </style><div class="content"></div>`);
  await page.addScriptTag({ content: script.code + geometry.code });
  const metrics = await page.evaluate(() => window.captureModule.getMetrics(true));
  await page.evaluate(() => window.captureModule.prepareCapture());
  assert.deepEqual(
    await page.evaluate(() => window.captureModule.getMetrics(true)),
    metrics,
    'hiding scrollbars must preserve layout',
  );
  const positions = await page.evaluate(
    (m) => window.geometryModule.computeScrollPositions(m.scrollHeight, m.viewportHeight),
    metrics,
  );
  const tiles = [];
  for (const y of positions) {
    const actual = await page.evaluate((y) => window.captureModule.scrollToPosition(y), y);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const data = await page.screenshot();
    const pixels = await sharp(data).raw().toBuffer();
    let scrollbarPixels = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      if (
        (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255) ||
        (pixels[i] === 0 && pixels[i + 1] === 255 && pixels[i + 2] === 0)
      )
        scrollbarPixels++;
    }
    assert.equal(scrollbarPixels, 0, 'captured viewport must not contain scrollbar paint');
    tiles.push({
      dataUrl: `data:image/png;base64,${data.toString('base64')}`,
      y: Math.round(actual.scrollY * 2),
    });
  }
  const width = metrics.viewportWidth * 2,
    height = metrics.scrollHeight * 2;
  const stitched = await page.evaluate(
    async ({ tiles, width, height, h }) =>
      window.captureModule.stitchTiles(tiles, width, height, { x: 0, y: 0, w: width, h }),
    { tiles, width, height, h: metrics.viewportHeight * 2 },
  );
  const actual = await sharp(Buffer.from(stitched.split(',')[1], 'base64'))
    .removeAlpha()
    .raw()
    .toBuffer();
  const baseline = await sharp(await page.screenshot({ fullPage: true }))
    .extract({ left: 0, top: 0, width, height })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert(
    actual.equals(baseline),
    'stitched content must match native full-page pixels, including overlap joins',
  );
  await page.evaluate(() => window.captureModule.restoreCapture());
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.style.getPropertyValue('scroll-behavior')),
    '',
  );
  // The page stylesheet and geometry survive cleanup.
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    'smooth',
  );

  await page.setContent(
    '<!doctype html><style>html,body{margin:0;height:100%;overflow:hidden}#scroller{width:700px;height:500px;border:7px solid red;overflow:auto;scroll-behavior:smooth!important}#content{height:1800px}</style><div id="scroller"><div id="content"></div></div>',
  );
  await page.addScriptTag({ content: script.code + geometry.code });
  const nested = await page.evaluate(() => window.captureModule.getMetrics(true));
  assert.equal(nested.container.x, 7, 'nested crop excludes left border');
  assert.equal(nested.container.y, 7, 'nested crop excludes top border');
  await page.evaluate(() => {
    const el = document.querySelector('#scroller');
    el.style.setProperty('scroll-behavior', 'smooth', 'important');
    window.captureModule.prepareCapture();
    window.captureModule.scrollToPosition(400);
    window.captureModule.restoreCapture();
  });
  assert.equal(
    await page.evaluate(() =>
      document.querySelector('#scroller').style.getPropertyValue('scroll-behavior'),
    ),
    'smooth',
    'restore pre-existing inline styles',
  );

  // Dashboard: a fixed shell holds the scroller while a footer overflows the document.
  await page.setContent(
    '<!doctype html><style>body{margin:0}::-webkit-scrollbar{width:18px}.shell{position:fixed;inset:0;display:flex}nav{width:200px}main{flex:1;overflow:auto}</style><div class="shell"><nav></nav><main id="main"><div style="height:3000px"></div></main></div><footer style="height:640px"></footer>',
  );
  await page.addScriptTag({ content: script.code });
  const dashboard = await page.evaluate(() => {
    const metrics = window.captureModule.getMetrics(true);
    window.captureModule.prepareCapture();
    window.captureModule.hideFixedElements();
    const main = document.querySelector('#main');
    const result = {
      metrics,
      tagged: main.dataset.ossScroller,
      visibility: getComputedStyle(main).visibility,
    };
    window.captureModule.restoreCapture();
    return result;
  });
  assert.equal(dashboard.tagged, '1', 'an inner panel that outscrolls the document wins');
  assert.equal(dashboard.metrics.scrollHeight, 3000);
  assert.equal(
    dashboard.visibility,
    'visible',
    'the fixed shell around the scroller stays visible',
  );

  // A taller nested scroller below the fold cannot be cropped; its visible parent wins.
  await page.setContent(
    '<!doctype html><style>body{margin:0;height:100vh;overflow:hidden}main{height:100vh;overflow:auto}#widget{width:80%;height:70vh;overflow:auto}</style><main id="main"><div style="height:800px"></div><div id="widget"><div style="height:4000px"></div></div></main>',
  );
  await page.addScriptTag({ content: script.code });
  const outer = await page.evaluate(() => {
    const metrics = window.captureModule.getMetrics(true);
    return { metrics, id: document.querySelector('[data-oss-scroller="1"]')?.id };
  });
  assert.equal(outer.id, 'main', 'an off-screen nested scroller is skipped');
  assert.deepEqual(outer.metrics.container, { x: 0, y: 0, width: 800, height: 600 });

  // Inner scroll boxes in the captured region grow to their content, then shrink back.
  await page.setContent(
    '<!doctype html><style>body{margin:0}.box{overflow:auto}</style><div style="height:600px"></div><div id="table" class="box" style="height:300px"><div style="height:2000px"></div></div><aside id="sticky" class="box" style="position:sticky;top:0;height:400px"><div style="height:3000px"></div></aside><div id="virtual" class="box" style="height:300px"><div style="height:20000px;position:relative"><span style="position:absolute;top:0">row</span></div></div><div style="height:300px;overflow:hidden"><div id="card" class="box" style="height:100%"><div style="height:900px"></div></div></div><div style="height:1500px"></div><script>document.querySelector("#table").scrollTop=120</script>',
  );
  await page.addScriptTag({ content: script.code });
  const expansion = await page.evaluate(() => {
    const before = document.documentElement.outerHTML;
    const metrics = window.captureModule.getMetrics(true);
    const expanded = [...document.querySelectorAll('[data-oss-expanded]')].map((el) => el.id);
    const tableHeight = document.querySelector('#table').clientHeight;
    window.captureModule.restoreCapture();
    return {
      metrics,
      expanded,
      tableHeight,
      restored: document.documentElement.outerHTML === before,
      scrollTop: document.querySelector('#table').scrollTop,
    };
  });
  assert.deepEqual(
    expansion.expanded,
    ['table'],
    'sticky boxes, virtual lists and clipped boxes stay as they are',
  );
  assert.equal(expansion.tableHeight, 2000);
  assert.equal(expansion.metrics.container, null);
  assert.equal(expansion.metrics.scrollHeight, 600 + 2000 + 400 + 300 + 300 + 1500);
  assert(expansion.restored, 'restore puts back the inline style');
  assert.equal(expansion.scrollTop, 120, 'restore puts back the inner scroll position');

  // A pinned shell cannot grow, so a panel that overflows by a little is scrolled instead.
  await page.setContent(
    '<!doctype html><style>body{margin:0;height:100vh;overflow:hidden;display:flex;flex-direction:column}header{height:80px;flex:none}main{flex:1;min-height:0;overflow:auto}</style><header></header><main id="main"><div style="height:770px"></div></main>',
  );
  await page.addScriptTag({ content: script.code });
  const pinned = await page.evaluate(() => {
    const metrics = window.captureModule.getMetrics(true);
    return { metrics, id: document.querySelector('[data-oss-scroller="1"]')?.id };
  });
  assert.equal(pinned.id, 'main', 'a small overflow in a pinned shell still wins');
  assert.equal(pinned.metrics.scrollHeight, 770);

  for (const direction of ['ltr', 'rtl']) {
    await page.setContent(
      `<!doctype html><html dir="${direction}"><style>html{scrollbar-gutter:stable;scrollbar-color:rgb(255,0,255) rgb(0,255,0)}body{margin:0;height:1800px;background:#112233}</style></html>`,
    );
    await page.addScriptTag({ content: script.code });
    const before = await page.evaluate(() => window.captureModule.getMetrics(true));
    const colors = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarColor,
    );
    await page.evaluate(() => window.captureModule.prepareCapture());
    assert.deepEqual(await page.evaluate(() => window.captureModule.getMetrics(true)), before);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor),
      'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)',
    );
    assert.equal(
      before.viewportLeft,
      await page.evaluate(() => document.documentElement.clientLeft),
    );
    await page.evaluate(() => window.captureModule.restoreCapture());
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor),
      colors,
    );
  }
  console.log(
    'Capture stitching: hidden scrollbars, native 2× pixels, exact seams, nested borders, expanded inner boxes and restoration passed.',
  );
} finally {
  await browser.close();
}
