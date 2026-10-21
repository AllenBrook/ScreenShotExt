import { expect, test } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { captureCloud, deviceLogin, isServerInvocation, runCli } from '../src/cli';

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
  expect(body).toMatchObject({
    url: 'https://example.com',
    format: 'pdf',
    viewport_width: 600,
    viewport_height: 400,
    full_page: true,
  });
  expect(body).not.toHaveProperty('redact');
});

test('cloud shot sends redaction targets to Cloud', async () => {
  let body: Record<string, unknown> = {};
  const fetcher = async (_: unknown, init: unknown) => {
    body = JSON.parse(String((init as RequestInit).body));
    return new Response(new Uint8Array([1]), { status: 200 });
  };
  const redact = { selectors: ['.email'], patterns: ['phone' as const], rects: [] };
  await captureCloud(
    { url: 'https://example.com', cloudKey: 'k', redact },
    {} as NodeJS.ProcessEnv,
    fetcher as never,
  );
  expect(body.redact).toEqual(redact);
});

test('cloud shot without a key fails before fetching', async () => {
  await expect(
    captureCloud({ url: 'https://example.com' }, {} as NodeJS.ProcessEnv, fetch, () => undefined),
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

function deviceServer(polls: { status: number; body: Record<string, unknown> }[]) {
  const calls: { url: string; body: Record<string, unknown>; auth?: string }[] = [];
  const fetcher = async (url: unknown, init: unknown) => {
    const i = init as RequestInit;
    const path = new URL(String(url)).pathname;
    calls.push({
      url: path,
      body: JSON.parse(String(i.body)),
      auth: (i.headers as Record<string, string>).authorization,
    });
    if (path === '/api/auth/device/code')
      return Response.json({
        device_code: 'dev-123',
        user_code: 'ABCDWXYZ',
        verification_uri: 'https://cloud.test/device',
        verification_uri_complete: 'https://cloud.test/device?user_code=ABCDWXYZ',
        expires_in: 600,
        interval: 5,
      });
    if (path === '/api/auth/device/token') {
      const next = polls.shift()!;
      return Response.json(next.body, { status: next.status });
    }
    return Response.json({ key: 'osc_live_minted', id: 'k1' });
  };
  return { calls, fetcher: fetcher as unknown as typeof fetch };
}

test('auth login approves a device code in the browser and stores the minted key', async () => {
  const { calls, fetcher } = deviceServer([
    { status: 400, body: { error: 'authorization_pending' } },
    { status: 400, body: { error: 'slow_down' } },
    { status: 200, body: { access_token: 'session-token', token_type: 'Bearer' } },
  ]);
  const waits: number[] = [];
  const lines: string[] = [];
  const opened: string[] = [];
  let saved = '';
  const key = await deviceLogin('https://cloud.test', {
    fetcher,
    sleep: async (ms) => void waits.push(ms),
    say: (l) => void lines.push(l),
    openUrl: (u) => void opened.push(u),
    save: (k) => void (saved = k),
  });
  expect(key).toBe('osc_live_minted');
  expect(saved).toBe('osc_live_minted');
  expect(lines[0]).toBe('Your code: ABCD-WXYZ');
  expect(opened).toEqual(['https://cloud.test/device?user_code=ABCDWXYZ']);
  expect(waits).toEqual([5000, 5000, 10000]);
  expect(calls[0]).toMatchObject({
    url: '/api/auth/device/code',
    body: { client_id: 'openscreenshot-cli' },
  });
  expect(calls[1].body).toEqual({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: 'dev-123',
    client_id: 'openscreenshot-cli',
  });
  expect(calls.at(-1)).toMatchObject({ url: '/api/cli-key', auth: 'Bearer session-token' });
});

test.each([
  ['access_denied', /denied in the browser/],
  ['expired_token', /code expired/],
])('auth login stops when the token endpoint answers %s', async (error, message) => {
  const { calls, fetcher } = deviceServer([{ status: 400, body: { error } }]);
  await expect(
    deviceLogin('https://cloud.test', {
      fetcher,
      sleep: async () => {},
      say: () => {},
      openUrl: () => {},
      save: () => {
        throw new Error('must not save');
      },
    }),
  ).rejects.toThrow(message);
  expect(calls.map((c) => c.url)).not.toContain('/api/cli-key');
});
