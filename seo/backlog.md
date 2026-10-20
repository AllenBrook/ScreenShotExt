# Backlog

Ordered by expected installs or CLI runs per hour of work. Each item names the query, the page,
and the change. Move a shipped item to `log.md`.

0. **Indexing: 417 of 480 known URLs are "Discovered, currently not indexed" (GSC, 2026-10-20,
   report dated 12 Oct).** 63 indexed, 16 crawled-not-indexed. The site is three months old and
   got 450 URLs on 9 Oct, so Google is pacing the crawl. Changes that help: more internal links
   to the deepest pages (the 11 locale hubs link every guide, but the guides barely link each
   other); the browser guides should cross-link all eight browsers; request indexing in the URL
   inspection tool, 10 a day (10 done on 2026-10-20, the next 10 are listed in `log.md`). Recheck the count
   weekly; if it does not fall by mid-November, cut the thinnest locale pages from the sitemap.
1. **Brand is the whole click volume.** "openscreenshot" and its misspellings are 120 of 164
   clicks in 3 months (GSC). Non-brand pages 1 to 10: `/full-page-screenshot/opera/` (7.0, 86
   impressions), `/es/full-page-screenshot/` (7.6, 140), `/es/full-page-screenshot/opera/` (7.5),
   `/de/full-page-screenshot/edge/` (7.0), `/fr/full-page-screenshot/opera/` (5.2),
   `/it/full-page-screenshot/edge/` (5.5), `/docs/` (5.6, 247). The generic English "full page
   screenshot" family sits at 48 to 97. First weekly push: the Opera and Edge browser guides in
   en, es, de, fr, it (rewrite the first paragraph to answer the query, add the built-in-tool
   steps with screenshots, link from the hub and the Chrome guide).
2. **`/full-page-screenshot/` hub: 199 impressions at position 26.2, 0 clicks** (GSC). The hub
   title answers "every browser"; the queries are per browser. Change: put the eight browser
   links with one-line answers at the top, and a comparison table of built-in limits.
3. **`/docs/`: 247 impressions, 1.6% CTR at position 5.6** (GSC, before the 2026-10-20 title
   change). Recheck the CTR on 2026-11-03 with the new title.
4. **Translate the titles and descriptions trimmed on 2026-10-20.** Pages: the three comparison
   posts in the ten non-English locales still carry descriptions over 160 characters. Change:
   shorten each locale's `description` to match the English one.
5. **"screenshot mcp server" / "mcp screenshot tool claude code".** Page:
   `/blog/screenshot-mcp-server/`. Change: the first paragraph must say "local stdio MCP server,
   `npx -y openscreenshot`, tool `capture_screenshot`, redact input" in plain words; add a
   client-by-client table (Claude Desktop, Claude Code, Cursor, Windsurf, VS Code) with the exact
   config for each; link it from `/docs/#agents-cli`, the npm README, and the GitHub README (done
   for the README on 2026-10-20). Web search on 2026-10-20 ranked glama.ai, mcp.so, and
   playbooks.com listings; a listing on each is the companion task in `directories.md`.
6. **"gofullpage alternative".** Page: `/alternatives/gofullpage/`. Change: the page did not
   appear in the first results on 2026-10-20; AlternativeTo and vendor comparisons did. Add a
   dated feature table with GoFullPage's current price and the annotation paywall, sourced from
   gofullpage.com, and claim the AlternativeTo entry so it links here.
7. **Split `/docs/#agents-cli` into its own page, `/docs/cli/`.** Query: "openscreenshot cli",
   "screenshot cli redact". Change: one page with every flag, exit code, the MCP config, and the
   redaction rules from `mcp/README.md`, in all 11 locales. Keep the `#agents-cli` anchor on
   `/docs/` with a short summary and a link.
8. **Capture element guide.** Query: "capture element screenshot chrome", "screenshot one div
   chrome". Gap. Change: a use-case page under `/use-cases/element-capture/` with the keyboard
   controls and the clipped-element fallback, linked from `/docs/#modes` and the bug-report guide.
9. **Sticky header and inner scroller troubleshooting.** Query: "full page screenshot sticky
   header repeated", "screenshot nested scroll chrome". Gap, and the two most common support
   complaints in `openscreenshot-feedback.csv`. Change: a support section or post that explains
   what the extension does with fixed headers and inner scrollers, and what still fails.
10. **Untranslated meta titles.** `/compare/` in es, fr, it, ja, ko, pt-br, zh-cn, zh-tw;
    `/roadmap/` in de, it, pt-br; `/support/` in de, fr; `/docs/` in fr; `/privacy/` in it. Change:
    translate `meta.title` in each locale's JSON so no two locale pages share a title.
11. **Home page `<title>` test.** Current: "Full-Page Screenshots for Chrome & Firefox —
    OpenScreenShot". Candidate once Search Console is connected: "OpenScreenShot: Free Full-Page
    Screenshot Extension for Chrome & Firefox". Needs click-rate data before a change.
12. **When the next npm release ships `--cloud`, `--format`, and `auth login`**, document them
    on `/blog/screenshot-cli/`, `/docs/#agents-cli`, and `mcp/README.md`, and add the query
    "screenshot api cli" to the map. Not before: the flags are unreleased as of 2026-10-20.
13. **AMO listing text.** `release/firefox/listing.md` does not mention element capture, which
    the Firefox build has. Change: add it, and resubmit the listing text.
14. **`http://www.openscreenshot.app/` still gets clicks (30 in 3 months, GSC).** It redirects in
    two hops (http www → https www → apex). A Cloudflare redirect rule from `www` straight to the
    apex over https would make it one hop. Outside this repository.
15. **`/api/stats.json` returns `null` for users and stars** (2026-10-20); the page shows the
    hard-coded fallback. Not a search issue, but the proof strip is a conversion element.
16. **Free tool (monthly).** Candidate: a "will my page need more than one image?" checker is too
    narrow. Better: a browser-side "screenshot to PDF" page that splits an uploaded PNG into
    A4/Letter pages locally, matching the extension's export. Query: "screenshot to pdf".
17. **Orphan-light pages.** `/full-page-screenshot/arc/` and `/safari/` have one inbound link
    each from page content. Change: link them from the Chrome and Firefox browser guides'
    "other browsers" paragraph.
