import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { capture, CaptureOptions } from '../src/capture';
import { runCli } from '../src/cli';
import { matchPattern } from '../src/redact';
import { decodePng } from './png';

const TOKEN = 'ghp_' + 'a1B2c3D4e5'.repeat(4);

const at = (top: number, left: number, css = '') =>
  `position:absolute;left:${left}px;top:${top}px;margin:0;${css}`;
const text = `font:20px monospace;line-height:24px;color:#0a0;background:#00f`;

const PAGES: Record<string, string> = {
  '/': `<body style="margin:0;background:#fff">
    <div id="card" style="${at(10, 10, 'width:100px;height:50px;background:#f00')}"></div>
    <input id="field" value="bob@example.org" style="${at(10, 200, 'width:150px;height:30px;background:#00f;border:0')}">
    <p style="${at(100, 10, text)}">alice@example.com</p>
    <p style="${at(150, 10, text)}">+1 (415) 555-0134</p>
    <p style="${at(200, 10, 'font:10px monospace;color:#0a0;background:#00f')}">${TOKEN}</p>
    <p style="${at(250, 10, text)}">hello world</p>
  </body>`,
  '/moving': `<body style="margin:0">
    <div id="mover" style="${at(10, 0, 'width:20px;height:20px;background:#f00')}"></div>
    <script>setInterval(() => { mover.style.left = (Math.floor(performance.now() / 2) % 300) + 'px'; }, 1);</script>
  </body>`,
  '/tall': `<body style="margin:0;height:3000px;background:#fff">
    <div id="bottom" style="${at(2800, 0, 'width:100px;height:100px;background:#f00')}"></div>
  </body>`,
  '/filtered': `<html style="filter:invert(1)"><body style="margin:0;background:#fff">
    <div id="card" style="${at(10, 10, 'width:100px;height:50px;background:#0ff')}"></div>
  </body></html>`,
};

let server: Server;
let base: string;
beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGES[req.url ?? '/'] ?? '');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const shot = async (path: string, extra: Record<string, unknown> = {}) =>
  decodePng(
    await capture(CaptureOptions.parse({ url: base + path, width: 400, height: 300, ...extra })),
  );
const BLACK = [0, 0, 0];

describe('patterns', () => {
  test('email', () => {
    expect(matchPattern('email', 'mail alice.b+x@mail.example.co.uk now')).toEqual([
      'alice.b+x@mail.example.co.uk',
    ]);
  });
  test('phone needs 9 to 15 digits', () => {
    expect(matchPattern('phone', 'call +1 (415) 555-0134 today')).toEqual(['+1 (415) 555-0134']);
    expect(matchPattern('phone', 'on 2026-10-17 at 10:30')).toEqual([]);
  });
  test('secret shapes', () => {
    for (const s of [
      TOKEN,
      'AKIAIOSFODNN7EXAMPLE',
      'sk-ant-api03-' + 'x'.repeat(30),
      'sk_live_' + 'a'.repeat(24),
      'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeK',
      'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    ])
      expect(matchPattern('secret', `key ${s} end`)).toEqual([s]);
    expect(matchPattern('secret', 'how-to-take-a-full-page-screenshot-in-chrome-2026')).toEqual([]);
  });
});

describe('capture with redact', () => {
  test('no redaction leaves the page as it is', async () => {
    const png = await shot('/');
    expect(png.pixel(60, 35)).toEqual([255, 0, 0]);
  });

  test('a selector covers the element', async () => {
    const png = await shot('/', { redact: { selectors: ['#card'] } });
    expect(png.pixel(60, 35)).toEqual(BLACK);
    expect(png.pixel(300, 280)).toEqual([255, 255, 255]);
  });

  test('patterns cover page text and form values, and leave other text', async () => {
    const png = await shot('/', { redact: { patterns: ['email', 'phone', 'secret'] } });
    for (const y of [102, 112, 122]) {
      expect(png.pixel(12, y)).toEqual(BLACK);
      expect(png.pixel(150, y)).toEqual(BLACK);
      expect(png.pixel(100, y + 50)).toEqual(BLACK);
    }
    expect(png.pixel(100, 206)).toEqual(BLACK);
    expect(png.pixel(275, 25)).toEqual(BLACK);
    for (let x = 12; x < 140; x += 4) expect(png.pixel(x, 262)).not.toEqual(BLACK);
  });

  test('a rectangle covers exact image pixels', async () => {
    const png = await shot('/', { redact: { rects: [{ x: 0, y: 0, width: 5, height: 5 }] } });
    expect(png.pixel(4, 4)).toEqual(BLACK);
    expect(png.pixel(6, 6)).toEqual([255, 255, 255]);
  });

  test('a full-page capture covers content below the first screen', async () => {
    const png = await shot('/tall', { fullPage: true, redact: { selectors: ['#bottom'] } });
    expect(png.height).toBeGreaterThanOrEqual(3000);
    expect(png.pixel(50, 2850)).toEqual(BLACK);
  });

  test('a filter on the page does not change the boxes', async () => {
    const png = await shot('/filtered', { redact: { selectors: ['#card'] } });
    expect(png.pixel(60, 35)).toEqual(BLACK);
  });

  test('a selector with no match fails', async () => {
    await expect(shot('/', { redact: { selectors: ['#card', '#nope'] } })).rejects.toThrow(
      'matched no elements: #nope',
    );
  });

  test('an invalid selector fails', async () => {
    await expect(shot('/', { redact: { selectors: ['[['] } })).rejects.toThrow('not valid CSS');
  });

  test('a rectangle outside the image fails', async () => {
    await expect(
      shot('/', { redact: { rects: [{ x: 500, y: 0, width: 5, height: 5 }] } }),
    ).rejects.toThrow('outside the 400x300 image');
  });

  test('a target that moves during the capture fails', async () => {
    await expect(shot('/moving', { redact: { selectors: ['#mover'] } })).rejects.toThrow(
      'changed during the capture',
    );
  });
});

describe('cli redact flags', () => {
  test('a bad rectangle is a usage error', async () => {
    expect(await runCli(['shot', 'https://example.com', '--redact-rect', '1,2'])).toBe(2);
  });
  test('an unknown pattern is a usage error', async () => {
    expect(await runCli(['shot', 'https://example.com', '--redact-pattern', 'email,nope'])).toBe(2);
  });
  test('a selector with no match writes no file', async () => {
    const out = '-';
    expect(await runCli(['shot', base + '/', '--out', out, '--redact', '#nope'])).toBe(1);
  });
});
