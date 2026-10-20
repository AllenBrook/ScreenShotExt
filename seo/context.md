# OpenScreenShot: product context for search work

Built 2026-10-20 from the repository and live sources. Every fact names its source. Rebuild when a
release changes a feature, a price, or a limit.

## What it is

- A free, MIT-licensed browser extension that takes full-page, visible-area, region, and element
  screenshots, annotates them, and exports PNG, JPEG, WebP, or PDF. The Chrome build also records
  the current tab. Everything runs on the device; the extension has no server, no account, and no
  telemetry. Source: `README.md`, `PRIVACY.md`, `site/src/i18n/en/docs.json`.
- A separate npm package, `openscreenshot`, that is a local CLI and a stdio MCP server. It drives
  the Chrome, Chromium, or Edge already installed and can redact selectors, text patterns, and
  rectangles before the screenshot. Source: `mcp/README.md`, `mcp/src/cli.ts`.
- OpenScreenShot Cloud, a separate proprietary hosted screenshot API at
  https://cloud.openscreenshot.app/ (free beta as of 2026-10-20, per `site/public/llms.txt`).
  Its code lives in the private `PGHQdev/openscreenshot-cloud` repository. The site links to it;
  this repository does not document its features. Source: `AGENTS.md`.

## Versions and distribution (2026-10-20)

| Surface          | Version | Source                                                           |
| ---------------- | ------- | ---------------------------------------------------------------- |
| Chrome Web Store | 2.5.1   | shields.io `chrome-web-store/v/hdabbojjccojlapnfjpdppcpfcnhgmdp` |
| Firefox Add-ons  | 2.5.1   | AMO API `addons/addon/openscreenshot/` (reviewed 2026-10-16)     |
| npm              | 2.5.1   | `npm view openscreenshot version`                                |
| Repository       | 2.5.1   | `manifest.json`, `package.json`, `mcp/package.json`              |

Unreleased on npm: the CLI `--cloud` flag, `--format`, `--key`, and `auth login/logout`
(commits a7e7fa6 and 867cae1 are after tag v2.5.1). Do not document them on the site until the
next npm release.

## Traction (2026-10-20)

| Metric                      | Value          | Source                                    |
| --------------------------- | -------------- | ----------------------------------------- |
| Chrome Web Store users      | 10k            | shields.io `chrome-web-store/users/...`   |
| Chrome Web Store rating     | 5/5            | shields.io `chrome-web-store/rating/...`  |
| Firefox average daily users | 28             | AMO API                                   |
| Firefox rating              | 5.0 (1 review) | AMO API                                   |
| GitHub stars                | 85             | `gh api repos/PGHQdev/OpenScreenShot`     |
| GitHub forks                | 7              | same                                      |
| npm downloads, all time     | 3.8k           | https://openscreenshot.app/api/stats.json |

## Who buys

There is no price. The conversions are:

1. An install from the Chrome Web Store or Firefox Add-ons.
2. An `npx openscreenshot` run, an MCP client config, or an `npm i -D openscreenshot`.
3. A sign-up at OpenScreenShot Cloud (hosted; tracked outside this repository).

Two audiences, per `site/CONTENT.md`: everyday users who need a full-page capture, a PDF, or a
redacted image; and developers or agents who need a screenshot from a terminal, CI, or an MCP
client.

## Features and limits that pages may state

Source: `site/src/i18n/en/docs.json` and `ROADMAP.md` unless noted.

- Capture modes: Full Page (scroll and stitch; fixed headers composited once; inner scrollers
  supported), Visible Area, Selected Region (resize handles, arrow-key nudge), Element (hover or
  keyboard; parent/child/sibling keys; full-page fallback for clipped elements).
- A full-page capture taller than 32,000 device pixels is saved as up to six images (v2.4.0).
- Entry points: toolbar icon (one-click Express mode by default), shortcuts
  (`Ctrl+Shift+S` full page, `Alt+Shift+V` visible, `Ctrl+Shift+E` region; macOS `⌘⇧S`, `⌥⇧V`,
  `⌘⇧E`), right-click menu, repeat last region, 3/5/10 s delay.
- After capture: Editor (default), Clipboard, or Download (PNG).
- Editor tools: select, shape (rectangle, rounded, oval, triangle, fill), arrow (four tips,
  curved), line, pen, highlighter, text, step number, blur (soft, mosaic, opaque), spotlight,
  eyedropper, crop, cut. 8-colour palette on keys 1 to 8, four stroke widths, undo/redo,
  reorderable rail, drafts saved locally.
- Frame: presets, spacing, corners, shadow, gradient or solid or transparent background.
- Import: drop or paste any image to annotate it.
- Export: PNG, JPEG, WebP, PDF (single page, fit to A4/Letter, or multi-page with 5 mm overlap);
  scale 25 to 200 % or exact width; copy to clipboard.
- Recording (Chrome only): tab or part of a tab, mic, tab audio, webcam bubble, auto zoom at
  clicks, manual zoom blocks, trim, click ripples, synthetic cursor; MP4 (H.264 + AAC, up to
  4096×2304) or WebM. Optional `tabCapture` permission, requested once. Optional `<all_urls>`
  only when "Record across sites" is on.
- Firefox: desktop 140 or later; screenshots, editing, and export; no recording.
  Source: `release/firefox/listing.md`, AMO API `compatibility.firefox.min`.
- Permissions at install: `activeTab`, `scripting`, `storage`, `unlimitedStorage`, `downloads`,
  `contextMenus`, `clipboardWrite`. `host_permissions` is empty. Source: `README.md`, AMO API.
- Cannot capture browser-internal pages (`chrome://`, `about:`) or extension pages.
  Source: `release/firefox/listing.md`, memory note "Extension pages are not capturable".

CLI and MCP (`mcp/README.md`):

- `openscreenshot shot <url> [--out file|-] [--full] [--width 200..3840] [--height 200..2160]
[--redact <selector>]... [--redact-pattern email|phone|secret]... [--redact-rect x,y,w,h]...`
- Output is always PNG. Exit codes 0, 1 (capture failed), 2 (usage).
- `openscreenshot` with no arguments on a pipe, or `openscreenshot serve`, starts the MCP server
  over stdio. Tool: `capture_screenshot` with `url`, `fullPage`, `width`, `height`, `redact`.
- Fresh headless browser each run: no cookies, no signed-in sessions, no clicks or waits;
  `networkidle2` up to 30 s. Needs Node 22.12+ and a local Chrome, Chromium, or Edge
  (`CHROME_PATH` override). Runs with `--no-sandbox`.

## Claims we make, and their basis

- "100 % local, no account, no telemetry": `PRIVACY.md`, empty `host_permissions`, AMO
  `data_collection_permissions: none`.
- "Open source, MIT": `LICENSE`.
- "No all-sites access at install": `manifest.json` has no `host_permissions`.
- Competitor facts on `/alternatives/*`, `/compare/`, and the two comparison posts carry their own
  "as of" dates and vendor links. Recheck them before an edit (AGENTS.md).

## Competitors

Browser extensions, each with an `/alternatives/` page: GoFullPage, FullPage Capture, Awesome
Screenshot, FireShot, Nimbus (now FuseBase), Lightshot, Screenity, Loom, Snagit.
Sitemap snapshots: `seo/competitors/`. gofullpage.com and prnt.sc publish no XML sitemap.

Developer tools, compared on `/blog/website-screenshot-tools-for-developers/`: shot-scraper,
capture-website-cli, pageres, Playwright, Puppeteer, Playwright MCP. Hosted APIs that show up
for "screenshot MCP server": ScreenshotOne (hosted MCP), plus many small desktop-capture MCP
servers on glama.ai, mcp.so, and playbooks.com (web search, 2026-10-20).

Also found for "full page screenshot chrome extension" (web search, 2026-10-20): CocoShot,
"Full Page Screenshot Capture", "Full Page Screen Capture". For "gofullpage alternative":
AlternativeTo (names ShareX, Flameshot, Greenshot, PicPick), Hoverify, SuperchargeCapture,
opencapture. Our `/alternatives/gofullpage/` was not in the first results.

## Data sources connected

- Live site, sitemap, and `sitemap-lastmod.json`: yes.
- GitHub API, AMO API, shields.io, npm registry: yes.
- Web search: yes (US results, no volumes).
- Google Search Console: not connected in this environment. It would give queries, positions,
  impressions, and indexing state per URL; the keyword map's volume and position columns stay
  empty until it is.
- Ahrefs or similar: not connected. It would give monthly volume and difficulty.
- Analytics: none by design (the site has no analytics). Store install counts are the only
  conversion signal, read from shields.io and the AMO API.
- ChatGPT, Perplexity, Google AI Overviews: not queried in this run; see `seo/ai-prompts.md`.
