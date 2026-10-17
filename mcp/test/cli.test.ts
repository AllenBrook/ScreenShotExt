import { expect, test } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { captureCloud, isServerInvocation, runCli } from '../src/cli';

test('shot writes a png file', async () => {
  const out = 'test-out.png';
  rmSync(out, { force: true });
  const code = await runCli([
    'shot',
    'https://example.com',
    '--out',
    out,
    '--width',
    '600',
    '--height',
    '400',
  ]);
  expect(code).toBe(0);
  expect(existsSync(out)).toBe(true);
  rmSync(out, { force: true });
});

test('missing url returns non-zero', async () => {
  expect(await runCli(['shot'])).not.toBe(0);
});

test('no arguments on a pipe, or serve, means the MCP server', () => {
  expect(isServerInvocation([], undefined)).toBe(true);
  expect(isServerInvocation([], false)).toBe(true);
  expect(isServerInvocation(['serve'], true)).toBe(true);
});

test('no arguments in a terminal, or any command, means the CLI', () => {
  expect(isServerInvocation([], true)).toBe(false);
  expect(isServerInvocation(['shot', 'https://example.com'], false)).toBe(false);
});

test('cloud shot posts to /v1/screenshot with the bearer key and writes bytes', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  };
  const bytes = await captureCloud(
    {
      url: 'https://example.com',
      format: 'pdf',
      width: 600,
      height: 400,
      fullPage: true,
      cloudKey: 'osc_test_x',
      cloudUrl: 'https://cloud.test',
    },
    {} as NodeJS.ProcessEnv,
    fetcher as never,
  );
  expect(bytes.length).toBe(3);
  expect(calls[0].url).toBe('https://cloud.test/v1/screenshot');
  expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer osc_test_x');
  const body = JSON.parse(String(calls[0].init.body));
  expect(body).toMatchObject({ url: 'https://example.com', format: 'pdf', full_page: true });
});

test('cloud shot without a key fails before fetching', async () => {
  await expect(
    captureCloud({ url: 'https://example.com' }, {} as NodeJS.ProcessEnv),
  ).rejects.toThrow('OPENSCREENSHOT_API_KEY');
});

test('cloud shot surfaces the problem code on failure', async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ error: { code: 'quota_exceeded', message: 'over quota' } }), {
      status: 402,
    });
  await expect(
    captureCloud(
      { url: 'https://example.com', cloudKey: 'k' },
      {} as NodeJS.ProcessEnv,
      fetcher as never,
    ),
  ).rejects.toThrow('over quota');
});
