import type { Page } from 'puppeteer-core';
import { z } from 'zod';

export const RedactPattern = z.enum(['email', 'phone', 'secret']);
export type RedactPattern = z.infer<typeof RedactPattern>;

export const Rect = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type Rect = z.infer<typeof Rect>;

export const Redact = z.object({
  selectors: z
    .array(z.string().min(1))
    .optional()
    .default([])
    .describe(
      'CSS selectors to cover. Each must match at least one element, or the capture fails.',
    ),
  patterns: z
    .array(RedactPattern)
    .optional()
    .default([])
    .describe('Text patterns to find and cover in page text and form values.'),
  rects: z
    .array(Rect)
    .optional()
    .default([])
    .describe('Rectangles to cover, in pixels of the output image.'),
});
export type Redact = z.infer<typeof Redact>;

// minDigits/maxDigits filter phone matches, because a regex cannot count digits
// spread across separators. Matching errs toward covering too much.
export const PATTERNS: Record<
  RedactPattern,
  { re: RegExp; minDigits?: number; maxDigits?: number }
> = {
  email: { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  phone: {
    re: /(?<![\w+])\+?\(?\d[\d\s().-]{6,}\d(?!\w)/g,
    minDigits: 9,
    maxDigits: 15,
  },
  secret: {
    re: new RegExp(
      [
        'sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}',
        '(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}',
        'gh[pousr]_[A-Za-z0-9]{36,}',
        'github_pat_[A-Za-z0-9_]{22,}',
        '(?:AKIA|ASIA)[0-9A-Z]{16}',
        'xox[abposr]-[A-Za-z0-9-]{10,}',
        'AIza[0-9A-Za-z_-]{35}',
        'eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}',
        // Long tokens and hashes: 32+ word characters with a letter and a digit.
        '(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]*\\d)(?=[A-Za-z0-9_]*[A-Za-z])[A-Za-z0-9_]{32,}(?![A-Za-z0-9_])',
      ].join('|'),
      'g',
    ),
  },
};

export function matchPattern(name: RedactPattern, text: string): string[] {
  const p = PATTERNS[name];
  return [...text.matchAll(p.re)]
    .map((m) => m[0])
    .filter((s) => {
      const digits = s.replace(/\D/g, '').length;
      return digits >= (p.minDigits ?? 0) && digits <= (p.maxDigits ?? Infinity);
    });
}

type PatternSpec = { source: string; flags: string; minDigits: number; maxDigits: number };
type Found = { missing: string[]; boxes: Rect[]; overlayBoxes: number };

// Runs in the page, so it must not reference anything outside its own body.
function findTargets(selectors: string[], patterns: PatternSpec[]): Found {
  const OVERLAY = '[data-oss-redact]';
  const boxes: Rect[] = [];
  const add = (r: { left: number; top: number; right: number; bottom: number }) => {
    if (r.right > r.left && r.bottom > r.top)
      boxes.push({ x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top });
  };

  const roots: (Document | ShadowRoot)[] = [document];
  for (let i = 0; i < roots.length; i++)
    for (const el of roots[i].querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);

  const missing: string[] = [];
  for (const sel of selectors) {
    let matched = 0;
    for (const root of roots) {
      let els: Element[];
      try {
        els = [...root.querySelectorAll(sel)];
      } catch {
        throw new Error(`redact selector is not valid CSS: ${sel}`);
      }
      for (const el of els) {
        if (el.closest(OVERLAY)) continue;
        matched++;
        // Union of the element, its text, and every descendant, so overflowing children are covered too.
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = [el, ...el.querySelectorAll('*')].map((d) => d.getBoundingClientRect());
        rects.push(range.getBoundingClientRect());
        const u = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
        for (const r of rects) {
          if (r.width === 0 && r.height === 0) continue;
          u.left = Math.min(u.left, r.left);
          u.top = Math.min(u.top, r.top);
          u.right = Math.max(u.right, r.right);
          u.bottom = Math.max(u.bottom, r.bottom);
        }
        add(u);
      }
    }
    if (matched === 0) missing.push(sel);
  }

  if (patterns.length > 0) {
    const res = patterns.map((p) => ({ ...p, re: new RegExp(p.source, p.flags) }));
    const hits = (text: string) =>
      res.flatMap((p) =>
        [...text.matchAll(p.re)].filter((m) => {
          const digits = m[0].replace(/\D/g, '').length;
          return digits >= p.minDigits && digits <= p.maxDigits;
        }),
      );
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const parent = n.parentElement;
        if (!parent || SKIP.has(parent.tagName) || parent.closest(OVERLAY)) continue;
        for (const m of hits(n.textContent ?? '')) {
          const range = document.createRange();
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          for (const r of range.getClientRects()) add(r);
        }
      }
      for (const el of root.querySelectorAll('input, textarea, select')) {
        const value =
          el instanceof HTMLSelectElement
            ? (el.selectedOptions[0]?.text ?? '')
            : (el as HTMLInputElement | HTMLTextAreaElement).value;
        if (hits(value).length > 0) add(el.getBoundingClientRect());
      }
    }
  }

  return {
    missing,
    boxes,
    overlayBoxes: document.querySelectorAll(`${OVERLAY} > div`).length,
  };
}

// Runs in the page. The host joins the top layer through the Popover API, so page
// stacking, transforms, and filters on ancestors cannot hide or tint the boxes.
function drawBoxes(boxes: Rect[]): void {
  const style = (el: HTMLElement, css: Record<string, string>) => {
    el.style.setProperty('all', 'initial', 'important');
    for (const [k, v] of Object.entries(css)) el.style.setProperty(k, v, 'important');
  };
  const host = document.createElement('div');
  host.setAttribute('data-oss-redact', '');
  host.setAttribute('popover', 'manual');
  style(host, {
    display: 'block',
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    overflow: 'visible',
    'pointer-events': 'none',
    'z-index': '2147483647',
  });
  for (const b of boxes) {
    const d = document.createElement('div');
    style(d, {
      display: 'block',
      position: 'fixed',
      left: `${b.x}px`,
      top: `${b.y}px`,
      width: `${b.width}px`,
      height: `${b.height}px`,
      background: '#000',
    });
    host.append(d);
  }
  document.documentElement.append(host);
  try {
    host.showPopover();
  } catch {
    // Without the top layer the host still sits on top through z-index.
  }
}

// Rounds each box outward, pads it, and clips it to the image. Found boxes get 2px
// of padding for antialiased edges; rectangles from the caller get none.
function fit(boxes: Rect[], width: number, height: number, pad: number): Rect[] {
  return boxes.flatMap((b) => {
    const x = Math.max(0, Math.floor(b.x - pad));
    const y = Math.max(0, Math.floor(b.y - pad));
    const right = Math.min(width, Math.ceil(b.x + b.width + pad));
    const bottom = Math.min(height, Math.ceil(b.y + b.height + pad));
    return right > x && bottom > y ? [{ x, y, width: right - x, height: bottom - y }] : [];
  });
}

function covered(target: Rect, boxes: Rect[]): boolean {
  return boxes.some(
    (b) =>
      target.x >= b.x - 1 &&
      target.y >= b.y - 1 &&
      target.x + target.width <= b.x + b.width + 1 &&
      target.y + target.height <= b.y + b.height + 1,
  );
}

export function hasRedaction(r: Redact | undefined): r is Redact {
  return !!r && r.selectors.length + r.patterns.length + r.rects.length > 0;
}

// Grows the viewport to the page height, so the boxes and the screenshot share one
// layout. Puppeteer's own full-page mode resizes during the capture, which can move
// content after the boxes are placed.
async function fitViewportToPage(page: Page, width: number): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const height = await page.evaluate(() => {
      window.scrollTo(0, 0);
      return document.documentElement.scrollHeight;
    });
    if (height === page.viewport()?.height) return;
    await page.setViewport({ width, height });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
  }
}

export async function captureRedacted(
  page: Page,
  redact: Redact,
  fullPage: boolean,
  width: number,
): Promise<Buffer> {
  if (fullPage) await fitViewportToPage(page, width);
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.pause();
  });
  const size = page.viewport()!;
  for (const r of redact.rects)
    if (r.x >= size.width || r.y >= size.height)
      throw new Error(
        `redact rect ${r.x},${r.y},${r.width},${r.height} is outside the ${size.width}x${size.height} image`,
      );

  const specs: PatternSpec[] = redact.patterns.map((name) => ({
    source: PATTERNS[name].re.source,
    flags: PATTERNS[name].re.flags,
    minDigits: PATTERNS[name].minDigits ?? 0,
    maxDigits: PATTERNS[name].maxDigits ?? Number.MAX_SAFE_INTEGER,
  }));
  const before = await page.evaluate(findTargets, redact.selectors, specs);
  if (before.missing.length > 0)
    throw new Error(`redact selector matched no elements: ${before.missing.join(', ')}`);

  const boxes = [
    ...fit(before.boxes, size.width, size.height, 2),
    ...fit(redact.rects, size.width, size.height, 0),
  ];
  await page.evaluate(drawBoxes, boxes);
  const png = await page.screenshot({ type: 'png' });

  // If the page moved a target after the boxes were placed, the image may show it.
  const after = await page.evaluate(findTargets, redact.selectors, specs);
  const moved = fit(after.boxes, size.width, size.height, 2).some((t) => !covered(t, boxes));
  if (moved || after.overlayBoxes !== boxes.length)
    throw new Error('the page changed during the capture, so the redaction may be incomplete');
  return Buffer.from(png);
}
