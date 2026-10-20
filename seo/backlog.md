# Backlog

Ordered by expected installs or CLI runs per hour of work. Each item names the query, the page,
and the change. Move a shipped item to `log.md`.

1. **Translate the titles and descriptions trimmed on 2026-10-20.** Pages: the three comparison
   posts in the ten non-English locales still carry descriptions over 160 characters. Change:
   shorten each locale's `description` to match the English one.
2. **"screenshot mcp server" / "mcp screenshot tool claude code".** Page:
   `/blog/screenshot-mcp-server/`. Change: the first paragraph must say "local stdio MCP server,
   `npx -y openscreenshot`, tool `capture_screenshot`, redact input" in plain words; add a
   client-by-client table (Claude Desktop, Claude Code, Cursor, Windsurf, VS Code) with the exact
   config for each; link it from `/docs/#agents-cli`, the npm README, and the GitHub README (done
   for the README on 2026-10-20). Web search on 2026-10-20 ranked glama.ai, mcp.so, and
   playbooks.com listings; a listing on each is the companion task in `directories.md`.
3. **"gofullpage alternative".** Page: `/alternatives/gofullpage/`. Change: the page did not
   appear in the first results on 2026-10-20; AlternativeTo and vendor comparisons did. Add a
   dated feature table with GoFullPage's current price and the annotation paywall, sourced from
   gofullpage.com, and claim the AlternativeTo entry so it links here.
4. **Split `/docs/#agents-cli` into its own page, `/docs/cli/`.** Query: "openscreenshot cli",
   "screenshot cli redact". Change: one page with every flag, exit code, the MCP config, and the
   redaction rules from `mcp/README.md`, in all 11 locales. Keep the `#agents-cli` anchor on
   `/docs/` with a short summary and a link.
5. **Capture element guide.** Query: "capture element screenshot chrome", "screenshot one div
   chrome". Gap. Change: a use-case page under `/use-cases/element-capture/` with the keyboard
   controls and the clipped-element fallback, linked from `/docs/#modes` and the bug-report guide.
6. **Sticky header and inner scroller troubleshooting.** Query: "full page screenshot sticky
   header repeated", "screenshot nested scroll chrome". Gap, and the two most common support
   complaints in `openscreenshot-feedback.csv`. Change: a support section or post that explains
   what the extension does with fixed headers and inner scrollers, and what still fails.
7. **Untranslated meta titles.** `/compare/` in es, fr, it, ja, ko, pt-br, zh-cn, zh-tw;
   `/roadmap/` in de, it, pt-br; `/support/` in de, fr; `/docs/` in fr; `/privacy/` in it. Change:
   translate `meta.title` in each locale's JSON so no two locale pages share a title.
8. **Home page `<title>` test.** Current: "Full-Page Screenshots for Chrome & Firefox —
   OpenScreenShot". Candidate once Search Console is connected: "OpenScreenShot: Free Full-Page
   Screenshot Extension for Chrome & Firefox". Needs click-rate data before a change.
9. **When the next npm release ships `--cloud`, `--format`, and `auth login`**, document them
   on `/blog/screenshot-cli/`, `/docs/#agents-cli`, and `mcp/README.md`, and add the query
   "screenshot api cli" to the map. Not before: the flags are unreleased as of 2026-10-20.
10. **AMO listing text.** `release/firefox/listing.md` does not mention element capture, which
    the Firefox build has. Change: add it, and resubmit the listing text.
11. **`/api/stats.json` returns `null` for users and stars** (2026-10-20); the page shows the
    hard-coded fallback. Not a search issue, but the proof strip is a conversion element.
12. **Free tool (monthly).** Candidate: a "will my page need more than one image?" checker is too
    narrow. Better: a browser-side "screenshot to PDF" page that splits an uploaded PNG into
    A4/Letter pages locally, matching the extension's export. Query: "screenshot to pdf".
13. **Orphan-light pages.** `/full-page-screenshot/arc/` and `/safari/` have one inbound link
    each from page content. Change: link them from the Chrome and Firefox browser guides'
    "other browsers" paragraph.
