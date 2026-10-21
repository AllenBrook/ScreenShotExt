---
name: capture-screenshot
description: Capture a PNG screenshot of any public web page locally, via the open-source OpenScreenShot CLI or MCP server.
---

# capture-screenshot

Capture a screenshot of a URL on your own machine. Local mode is the default and needs no account.

## Install

`npx openscreenshot` (uses the Chrome already on your machine — no browser download; set `CHROME_PATH` if it can't be found).

## CLI

`openscreenshot shot https://example.com --out shot.png --full`

## MCP (for agents)

Add to your MCP client config:
`{ "command": "npx", "args": ["openscreenshot"] }`
Then call the `capture_screenshot` tool with `{ "url": "https://example.com" }`.

## Redaction

Cover data with black boxes before the screenshot, so the image never contains it:

- CLI: `--redact "#account-menu" --redact-pattern email,phone,secret --redact-rect 0,0,200,40`
- MCP: `{ "url": "https://example.com", "redact": { "selectors": ["#account-menu"], "patterns": ["email", "phone", "secret"], "rects": [{ "x": 0, "y": 0, "width": 200, "height": 40 }] } }`

The capture fails with no image if a selector matches nothing or the page moves a target during the capture. Patterns can miss text; check the image.

## OpenScreenShot Cloud (optional)

Render the page on OpenScreenShot Cloud instead of the local Chrome. The URL and the options go to Cloud.

1. Sign in once: `openscreenshot auth login` (approve the code in the browser; the API key is stored in `~/.openscreenshot.json`). Or set `OPENSCREENSHOT_API_KEY`.
2. CLI: `openscreenshot shot https://example.com --out shot.png --full --cloud`. With `--cloud`, `--format` accepts `png`, `jpeg`, `webp`, `pdf`, `html`, or `markdown`.
3. MCP: call `capture_screenshot` with `{ "url": "https://example.com", "cloud": true }`.

Redaction works in Cloud mode and needs PNG output. Docs: https://cloud.openscreenshot.app/docs

Source: https://github.com/pghqdev/OpenScreenShot
