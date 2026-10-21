---
title: Set up a local screenshot MCP server for an AI agent
description: Connect OpenScreenShot to a stdio MCP client and request PNG screenshots with explicit URL, viewport, and full-page options.
audience: developers
order: 5
published: 2026-09-18
updated: 2026-10-21
---

OpenScreenShot provides a local MCP server with one tool: `capture_screenshot`. An MCP client can call it with a webpage URL and receive PNG image content. By default, the server launches a separate headless Chrome-compatible browser on your machine; the browser extension is not required.

## Add the server to your MCP client

Install Node.js, pnpm, and a Chrome-compatible browser first. Add a server entry using your client’s configuration format. Clients that accept an `mcpServers` object can use:

```json
{
  "mcpServers": {
    "openscreenshot": {
      "command": "pnpm",
      "args": ["dlx", "openscreenshot"]
    }
  }
}
```

The client must be able to find `pnpm` on its executable path. Restart or reload its MCP connections after saving the configuration. The server uses stdio, so the client starts a local process and there is no URL to enter. For clients that accept only remote MCP URLs, OpenScreenShot Cloud has a remote endpoint, described below.

If Chrome is installed somewhere unusual, pass `CHROME_PATH` through the client’s environment configuration. Use the full path to the executable, rather than the folder containing the application.

## Call capture_screenshot

A minimal tool input is:

```json
{ "url": "https://example.com" }
```

This produces a viewport capture at the default 1280 × 800 size. Set the viewport and full-page option explicitly for a reproducible request:

```json
{
  "url": "https://example.com",
  "fullPage": true,
  "width": 1440,
  "height": 900
}
```

`width` accepts integers from 200 to 3840 and `height` from 200 to 2160. The tool returns MCP image content with MIME type `image/png`. There is no output-path argument for this tool. Whether the result is displayed or saved depends on the client; use the [CLI](/blog/screenshot-cli/) when you need a named file directly.

## Redact data before the image leaves the tool

Add a `redact` object to cover data with black boxes in the page before the screenshot. The client receives only the redacted image:

```json
{
  "url": "https://example.com",
  "redact": {
    "selectors": ["#account-menu"],
    "patterns": ["email", "phone", "secret"],
    "rects": [{ "x": 0, "y": 0, "width": 200, "height": 40 }]
  }
}
```

`selectors` covers each matching element with all of its children. `patterns` covers matching text and form values: `email`, `phone` (9 to 15 digits), and `secret` (common API key and token shapes, and long hashes). `rects` covers rectangles in pixels of the output image, for canvas, images, and cross-origin iframes. The tool returns an error and no image if a selector matches nothing, a rectangle is outside the image, or the page moves a target during the capture. Patterns can miss text that is split across elements or drawn in an image.

## Render on OpenScreenShot Cloud

Add `cloud: true` to render the page on [OpenScreenShot Cloud](https://cloud.openscreenshot.app), an optional hosted screenshot API, instead of the local Chrome:

```json
{ "url": "https://example.com", "fullPage": true, "cloud": true }
```

Cloud mode needs an API key. Run `pnpm dlx openscreenshot auth login` once to store one, or set `OPENSCREENSHOT_API_KEY` in the server’s environment configuration in the client. `redact` works in both modes. In Cloud mode, the Cloud server draws the black boxes before it returns the image.

Cloud also serves a remote MCP endpoint over Streamable HTTP at `https://cloud.openscreenshot.app/mcp`, with the same `capture_screenshot` tool. Send the API key in an `Authorization: Bearer <key>` header. Use it with clients that accept only remote MCP URLs. The free plan gives 100 captures per month with no card; the [pricing page](https://cloud.openscreenshot.app/pricing) lists the other plans.

## What the agent can and cannot see

The capture starts in a fresh headless browser. It does not inherit the cookies or signed-in session from your ordinary Chrome window. A page behind authentication may therefore produce a login screen. The current tool does not expose login steps, cookie injection, selector waits, or interactive clicks.

Ask the agent to identify what is actually visible in the returned image before drawing conclusions. A screenshot can help inspect layout, spacing, and visible errors; it cannot establish that a form submits correctly or that keyboard navigation works.

## Where does the screenshot go?

By default, the screenshot is generated locally and returned to the MCP client. If that client uses a hosted model, it may transmit the returned image to the model provider according to its own settings. Local capture does not imply that the whole agent conversation stays on the device. Use `redact` for data that must not reach the provider. With `cloud: true`, the URL and the options go to OpenScreenShot Cloud, and the page renders on its servers; see the [Cloud privacy policy](https://cloud.openscreenshot.app/privacy).

For automated captures with predictable dimensions, see [screenshots for CI](/blog/screenshots-for-ci/). The [agent capture skill](/skills/capture-screenshot.md) and [server source](https://github.com/pghqdev/OpenScreenShot/blob/main/mcp/src/serve.ts) provide the machine-oriented instructions and tool definition. The server is also listed on [Glama](https://glama.ai/mcp/servers/PGHQdev/OpenScreenShot).
