// Thin wrapper around the static asset handler: adds a Link header on the
// homepage (RFC 8288 agent discovery), serves a page's index.md when a client
// negotiates Accept: text/markdown, and points each Markdown copy at its HTML
// page with a canonical Link header so search engines index the HTML.
const HOMEPAGE_LINK =
  '</.well-known/api-catalog>; rel="api-catalog", </skills/capture-screenshot.md>; rel="service-doc"';

// Same-origin proxy for the Ko-fi support widget. Some ad blockers filter
// requests to ko-fi.com / storage.ko-fi.com, which would silently remove the
// widget; serving it from our own origin avoids that. Only the two CDN image
// assets the widget actually uses are proxied (no open proxy).
const KOFI_CDN = 'https://storage.ko-fi.com/cdn';
const KOFI_ASSETS = new Set(['cup-border.png', 'whitelogo.svg']);
const KOFI_CACHE = { cf: { cacheEverything: true, cacheTtl: 86400 } };

async function proxyKofiWidget() {
  const upstream = await fetch(`${KOFI_CDN}/widget/Widget_2.js`, KOFI_CACHE);
  if (!upstream.ok) return new Response('Ko-fi widget unavailable', { status: 502 });
  const script = (await upstream.text()).replaceAll(`${KOFI_CDN}/`, '/kofi-cdn/');
  return new Response(script, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
}

async function proxyKofiAsset(pathname) {
  const name = pathname.slice('/kofi-cdn/'.length);
  if (!KOFI_ASSETS.has(name)) return new Response('Not found', { status: 404 });
  const upstream = await fetch(`${KOFI_CDN}/${name}`, KOFI_CACHE);
  if (!upstream.ok) return new Response('Ko-fi asset unavailable', { status: 502 });
  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'public, max-age=604800',
    },
  });
}

// Live user, rating, star and version counts. Read from shields.io — the
// same source as the README badges — and cached at the edge, so nothing but
// this Worker ever talks to a third party. Two consumers share this: the
// homepage (users/rating/ratings in the proof strip, stars/npm in the
// developer section, injected server-side with HTMLRewriter — the markup
// ships each item hidden and empty, and an item stays hidden when a source
// it needs doesn't answer) and the public /api/stats.json endpoint, live
// since 95a14dd.
const STAT_SOURCES = {
  users: 'https://img.shields.io/chrome-web-store/users/hdabbojjccojlapnfjpdppcpfcnhgmdp.json',
  rating: 'https://img.shields.io/chrome-web-store/rating/hdabbojjccojlapnfjpdppcpfcnhgmdp.json',
  ratings:
    'https://img.shields.io/chrome-web-store/rating-count/hdabbojjccojlapnfjpdppcpfcnhgmdp.json',
  stars: 'https://img.shields.io/github/stars/pghqdev/OpenScreenShot.json',
  version: 'https://img.shields.io/chrome-web-store/v/hdabbojjccojlapnfjpdppcpfcnhgmdp.json',
};
// npm downloads come from api.npmjs.org itself: no key, and the shields.io
// npm badge is the one source that regularly times out. One range call covers
// 18 months at most, so the all-time total is summed over windows from the
// package's first day on npm.
const NPM_PACKAGE = 'openscreenshot';
const NPM_FIRST_DAY = '2026-08-01';
const NPM_WINDOW_DAYS = 540;
const STAT_SHAPE = /^\d[\d,.kKmM+]*$/;
// The English homepage and the locale homepages (LOCALES in
// site/src/i18n/index.ts). A locale missing here still gets its numbers
// from the page's own /api/stats.json refresh, only later.
const HOMEPAGE_PATH = /^\/(?:(?:de|es|fr|it|ja|ko|pt-br|ru|zh-cn|zh-tw)\/)?$/;
const VERSION_SHAPE = /^v?\d+(\.\d+)*$/;
// The rating badge reads "5/5" or "4.6/5", the count badge "10 total". The
// page shows "{rating}/5" and "{count}", so each keeps only its number,
// the named group n.
const RATING_BADGE = /^(?<n>[0-5](?:\.\d)?)\/5$/;
const RATINGS_BADGE = /^(?<n>\d[\d,]*) total$/;
const STATS_TTL = 21600;
/*
 * The homepage's first byte waits on this: the stat lookups run alongside
 * the asset fetch, but the HTML cannot start streaming until the rewriter
 * is attached. Giving up early leaves an item hidden until the page's own
 * /api/stats.json refresh fills it, which costs freshness and nothing else.
 */
const STATS_TIMEOUT_MS = 500;

function* npmWindows(firstDay) {
  const day = 86400000;
  const today = new Date(new Date().toISOString().slice(0, 10));
  for (let start = new Date(firstDay); start <= today;) {
    const end = new Date(Math.min(start.getTime() + (NPM_WINDOW_DAYS - 1) * day, today.getTime()));
    yield [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
    start = new Date(end.getTime() + day);
  }
}

// Same shape as a shield value, so STAT_SHAPE and the rewriter accept it.
function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

async function npmDownloads() {
  const timeout = AbortSignal.timeout(STATS_TIMEOUT_MS);
  try {
    let total = 0;
    for (const [start, end] of npmWindows(NPM_FIRST_DAY)) {
      const upstream = await fetch(
        `https://api.npmjs.org/downloads/range/${start}:${end}/${NPM_PACKAGE}`,
        { cf: { cacheEverything: true, cacheTtl: STATS_TTL }, signal: timeout },
      );
      if (!upstream.ok) return null;
      const body = await upstream.json();
      for (const d of body.downloads ?? []) total += Number(d.downloads) || 0;
    }
    return compact(total);
  } catch {
    return null;
  }
}

async function shieldValue(url, shape) {
  const timeout = AbortSignal.timeout(STATS_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      cf: { cacheEverything: true, cacheTtl: STATS_TTL },
      signal: timeout,
    });
    if (!upstream.ok) return null;
    const badge = await upstream.json();
    const match = (badge.value ?? '').match(shape);
    return match ? (match.groups?.n ?? match[0]) : null;
  } catch {
    return null;
  }
}

async function siteStats() {
  const [users, rating, ratings, stars, version, npm] = await Promise.all([
    shieldValue(STAT_SOURCES.users, STAT_SHAPE),
    shieldValue(STAT_SOURCES.rating, RATING_BADGE),
    shieldValue(STAT_SOURCES.ratings, RATINGS_BADGE),
    shieldValue(STAT_SOURCES.stars, STAT_SHAPE),
    shieldValue(STAT_SOURCES.version, VERSION_SHAPE),
    npmDownloads(),
  ]);
  const stats = { users, rating, ratings, stars, version, npm };
  // A null is a timed-out lookup, not a value: cache it for a minute, not six
  // hours, so the next visitor gets a fresh try.
  const ttl = Object.values(stats).includes(null) ? 60 : STATS_TTL;
  return new Response(JSON.stringify(stats), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${ttl}`,
    },
  });
}

class StatRewriter {
  constructor(value) {
    this.value = value;
  }
  element(el) {
    if (this.value !== null) el.setInnerContent(this.value);
  }
}

class StatItemRewriter {
  constructor(value) {
    this.value = value;
  }
  element(el) {
    if (this.value !== null) el.removeAttribute('hidden');
  }
}

/*
 * Takes the asset fetch as a promise, not an awaited Response, so the two
 * shield lookups run alongside it rather than after it — awaiting the asset
 * first put the whole shield round trip between the request and the first
 * byte of HTML on an edge cache miss.
 *
 * The degrade contract: a lookup that times out or answers badly yields
 * null, null leaves that item hidden for the browser refresh to fill, and
 * every lookup being null skips the rewriter entirely. The rating item
 * needs both of its numbers.
 */
async function withInjectedStats(assetPromise) {
  const [response, users, rating, ratings, stars, npm] = await Promise.all([
    assetPromise,
    shieldValue(STAT_SOURCES.users, STAT_SHAPE),
    shieldValue(STAT_SOURCES.rating, RATING_BADGE),
    shieldValue(STAT_SOURCES.ratings, RATINGS_BADGE),
    shieldValue(STAT_SOURCES.stars, STAT_SHAPE),
    npmDownloads(),
  ]);
  if ([users, rating, ratings, stars, npm].every((v) => v === null)) return response;
  // Safe by construction, not by a guard here: .transform() returns
  // synchronously and runs StatRewriter.element() later, lazily, as the body
  // streams to the client, so a try/catch around this call can never see
  // that later work. The actual invariant is upstream — STAT_SHAPE and the
  // two rating patterns reject anything that isn't a bare digit-led value,
  // so setInnerContent() here never receives a string that could break the
  // surrounding markup. Don't loosen them without re-deriving this guarantee.
  const bothRatings = rating !== null && ratings !== null ? rating : null;
  return new HTMLRewriter()
    .on('[data-stat="users"]', new StatRewriter(users))
    .on('[data-stat="rating"]', new StatRewriter(rating))
    .on('[data-stat="ratings"]', new StatRewriter(ratings))
    .on('[data-stat="stars"]', new StatRewriter(stars))
    .on('[data-stat="npm"]', new StatRewriter(npm))
    .on('[data-stat-item="users"]', new StatItemRewriter(users))
    .on('[data-stat-item="rating"]', new StatItemRewriter(bothRatings))
    .on('[data-stat-item="stars"]', new StatItemRewriter(stars))
    .on('[data-stat-item="npm"]', new StatItemRewriter(npm))
    .transform(response);
}

/*
 * Uninstall feedback (rating funnel Surface D).
 *
 * This is the site's only write endpoint and the only place the project stores
 * anything a person typed. It takes what they wrote plus the two values the
 * uninstall URL already carried, and deliberately records nothing else — no
 * IP, no user agent, no referrer, no cookie, no id that outlives the request.
 * That is a promise made in PRIVACY.md and on the privacy page, so keep it:
 * anything added to this INSERT has to be disclosed there first.
 *
 * It replaced a mailto: link, which asked the sender to have a mail client,
 * find the send button in it, and hand over their own address to say "the
 * footer was missing". Most did not. The link stays on the page under the
 * form, for anyone who would rather write than type into a box.
 */
const FEEDBACK_MAX_MESSAGE = 4000;
const FEEDBACK_MAX_CONTACT = 200;
/** Submissions one IP may make per window. The IP is used here and never stored. */
const FEEDBACK_RATE_LIMIT = 5;
const FEEDBACK_WINDOW_MS = 10 * 60 * 1000;
const feedbackHits = new Map();

/** Shape-check a value the client controls, and bound it. '' when it fails. */
function boundedField(value, max, shape) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().slice(0, max);
  return shape && !shape.test(trimmed) ? '' : trimmed;
}

/**
 * Per-isolate, per-window submission cap. A Worker isolate is neither shared
 * nor durable, so this is a speed bump against a stuck retry loop or one
 * bored visitor — not a defence against a distributed flood. D1 write limits
 * are the real backstop, and the endpoint stores too little to be worth
 * flooding. A Durable Object would make it exact, at the cost of a stateful
 * dependency for a form that sees a handful of writes a day.
 */
function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  for (const [key, hits] of feedbackHits) {
    const live = hits.filter((t) => now - t < FEEDBACK_WINDOW_MS);
    if (live.length === 0) feedbackHits.delete(key);
    else feedbackHits.set(key, live);
  }
  const mine = feedbackHits.get(ip) ?? [];
  if (mine.length >= FEEDBACK_RATE_LIMIT) return true;
  feedbackHits.set(ip, [...mine, now]);
  return false;
}

function feedbackJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function submitFeedback(request, env) {
  if (request.method !== 'POST') return feedbackJson(405, { error: 'method' });
  // The form is same-origin; a cross-origin POST has no business here and the
  // endpoint sends no CORS headers, so a browser would not surface the answer
  // anyway. This makes the refusal explicit rather than incidental.
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return feedbackJson(403, { error: 'origin' });
  }
  if (!env.FEEDBACK_DB) return feedbackJson(503, { error: 'unavailable' });
  if (rateLimited(request.headers.get('CF-Connecting-IP'))) {
    return feedbackJson(429, { error: 'rate' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return feedbackJson(400, { error: 'json' });
  }

  const message = boundedField(payload?.message, FEEDBACK_MAX_MESSAGE);
  if (!message) return feedbackJson(400, { error: 'empty' });
  const version = boundedField(payload?.version, 32, /^[\w.+-]*$/) || 'unknown';
  const locale = boundedField(payload?.locale, 8, /^[a-z-]*$/) || 'en';
  const contact = boundedField(payload?.contact, FEEDBACK_MAX_CONTACT);

  try {
    await env.FEEDBACK_DB.prepare(
      'INSERT INTO feedback (version, locale, message, contact) VALUES (?, ?, ?, ?)',
    )
      .bind(version, locale, message, contact)
      .run();
  } catch {
    // The page keeps the mail link visible, so a failure here costs the sender
    // a second route rather than their words.
    return feedbackJson(500, { error: 'write' });
  }
  return feedbackJson(201, { ok: true });
}

const CAPTURE_ERROR_MAX_MESSAGE = 4000;
const CAPTURE_ERROR_MAX_DETAIL = 4000;
const CAPTURE_ERROR_MAX_URL = 2000;
const CAPTURE_ERROR_MAX_TITLE = 500;
const CAPTURE_ERROR_MAX_CODE = 64;
const CAPTURE_ERROR_MAX_VERSION = 32;
const CAPTURE_ERROR_MAX_LOCALE = 16;

function captureErrorOrigin(origin) {
  if (!origin || origin === 'https://openscreenshot.app') return null;
  if (/^(?:chrome|moz)-extension:\/\/[^/]+$/i.test(origin)) return origin;
  return undefined;
}

function captureErrorJson(status, body, origin = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function submitCaptureError(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = captureErrorOrigin(origin);
  if (allowedOrigin === undefined) return captureErrorJson(403, { ok: false, error: 'origin' });
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin, vary: 'Origin' } : {}),
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      },
    });
  }
  if (request.method !== 'POST')
    return captureErrorJson(405, { ok: false, error: 'method' }, allowedOrigin);
  if (!env.FEEDBACK_DB)
    return captureErrorJson(503, { ok: false, error: 'unavailable' }, allowedOrigin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return captureErrorJson(400, { ok: false, error: 'json' }, allowedOrigin);
  }
  const code = boundedField(payload?.code, CAPTURE_ERROR_MAX_CODE, /^[a-z0-9-]+$/i) || 'unknown';
  const message = boundedField(payload?.message, CAPTURE_ERROR_MAX_MESSAGE);
  if (!message) return captureErrorJson(400, { ok: false, error: 'message' }, allowedOrigin);
  const detail = boundedField(payload?.detail, CAPTURE_ERROR_MAX_DETAIL);
  const version =
    boundedField(payload?.version, CAPTURE_ERROR_MAX_VERSION, /^[\w.+-]*$/) || 'unknown';
  const locale = boundedField(payload?.locale, CAPTURE_ERROR_MAX_LOCALE, /^[a-z-]*$/i) || 'en';
  const url = boundedField(payload?.url, CAPTURE_ERROR_MAX_URL);
  const title = boundedField(payload?.title, CAPTURE_ERROR_MAX_TITLE);
  try {
    await env.FEEDBACK_DB.prepare(
      'INSERT INTO capture_error_reports (code, message, detail, version, locale, url, title) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(code, message, detail, version, locale, url, title)
      .run();
  } catch {
    return captureErrorJson(500, { ok: false, error: 'write' }, allowedOrigin);
  }
  return captureErrorJson(201, { ok: true }, allowedOrigin);
}

async function route(url, request, env) {
  // The capture beta moved to OpenScreenShot Cloud. 308 keeps the method for API calls.
  if (url.pathname === '/capture' || url.pathname.startsWith('/capture/')) {
    const path = url.pathname.slice('/capture'.length) || '/';
    return Response.redirect(`https://cloud.openscreenshot.app${path}${url.search}`, 308);
  }
  const accept = request.headers.get('Accept') ?? '';

  if (url.pathname === '/api/feedback') return submitFeedback(request, env);
  if (url.pathname === '/api/capture-errors') return submitCaptureError(request, env);
  if (url.pathname === '/api/stats.json') return siteStats();
  if (url.pathname === '/kofi-widget.js') return proxyKofiWidget();
  if (url.pathname.startsWith('/kofi-cdn/')) return proxyKofiAsset(url.pathname);

  if (url.pathname.endsWith('/') && accept.includes('text/markdown')) {
    const md = await env.ASSETS.fetch(new URL(`${url.pathname}index.md`, url));
    if (md.ok) return markdownResponse(md, url.pathname, url);
  }
  if (url.pathname.endsWith('/index.md')) {
    const md = await env.ASSETS.fetch(request);
    return md.ok ? markdownResponse(md, url.pathname.slice(0, -'index.md'.length), url) : md;
  }
  if (HOMEPAGE_PATH.test(url.pathname)) return withInjectedStats(env.ASSETS.fetch(request));

  return env.ASSETS.fetch(request);
}

/** A Markdown copy of an HTML page, canonical to that page. */
function markdownResponse(md, pagePath, url) {
  return new Response(md.body, {
    status: md.status,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      Link: `<${new URL(pagePath, url).href}>; rel="canonical"`,
      Vary: 'Accept',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await route(url, request, env);

    const headers = new Headers(response.headers);
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (url.pathname === '/') headers.append('Link', HOMEPAGE_LINK);
    return new Response(response.body, { status: response.status, headers });
  },
};
