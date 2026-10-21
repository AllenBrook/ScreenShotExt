import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { capture, CaptureOptions } from './capture.js';
import { hasRedaction } from './redact.js';

const USAGE =
  'usage: openscreenshot shot <url> [--out file|-] [--full] [--width n] [--height n]\n' +
  '         [--redact selector]... [--redact-pattern email|phone|secret]... [--redact-rect x,y,w,h]...\n' +
  '         [--cloud [base-url]] [--key osc_live_…] [--format png|jpeg|webp|pdf|html|markdown]\n' +
  '         --cloud renders through OpenScreenShot Cloud instead of local Chrome.\n' +
  '         Auth order: --key, OPENSCREENSHOT_API_KEY, key stored by `auth login`.\n' +
  '         Base URL: --cloud <url> or OPENSCREENSHOT_CLOUD_URL\n' +
  '         (default https://cloud.openscreenshot.app).\n' +
  '       openscreenshot auth login [--cloud <url>]\n' +
  '         Shows a code and opens the browser to approve it, then stores an API key\n' +
  '         at ~/.openscreenshot.json.\n' +
  '       openscreenshot auth logout   removes the stored key.\n' +
  '       openscreenshot serve   MCP server over stdio; also the default with no arguments on a pipe\n';

const CONFIG = join(homedir(), '.openscreenshot.json');

function storedKey(): string | undefined {
  try {
    return (JSON.parse(readFileSync(CONFIG, 'utf8')) as { key?: string }).key;
  } catch {
    return undefined;
  }
}

const CLIENT_ID = 'openscreenshot-cli';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

export interface LoginDeps {
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  openUrl?: (url: string) => void;
  say?: (line: string) => void;
  save?: (key: string) => void;
}

function saveKey(key: string): void {
  writeFileSync(CONFIG, JSON.stringify({ key, created_at: Date.now() }, null, 2) + '\n', {
    mode: 0o600,
  });
}

function openInBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' })
      .on('error', () => {})
      .unref();
  } catch {
    // The printed link still works.
  }
}

/**
 * `auth login`: the device authorization grant (RFC 8628). The user approves the shown
 * code in the browser, where they sign in; the CLI never asks for an email or a password.
 * Returns the minted API key.
 */
export async function deviceLogin(base: string, deps: LoginDeps = {}): Promise<string> {
  const fetcher = deps.fetcher ?? fetch;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const say = deps.say ?? ((line) => process.stdout.write(line + '\n'));
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetcher(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  const start = await post('/api/auth/device/code', { client_id: CLIENT_ID });
  if (!start.ok) throw new Error(`could not start sign-in (${start.status})`);
  const grant = (await start.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval?: number;
  };
  const code = grant.user_code.replace(/^(.{4})(.{4})$/, '$1-$2');
  const link = grant.verification_uri_complete ?? grant.verification_uri;
  say(`Your code: ${code}`);
  say(`Approve it at ${link}`);
  (deps.openUrl ?? openInBrowser)(link);

  let interval = (grant.interval ?? 5) * 1000;
  const deadline = Date.now() + grant.expires_in * 1000;
  let token: string | undefined;
  while (!token) {
    if (Date.now() > deadline)
      throw new Error('the code expired; run `openscreenshot auth login` again');
    await sleep(interval);
    const res = await post('/api/auth/device/token', {
      grant_type: DEVICE_GRANT,
      device_code: grant.device_code,
      client_id: CLIENT_ID,
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
    if (res.ok && body.access_token) token = body.access_token;
    else if (body.error === 'slow_down') interval += 5000;
    else if (body.error === 'access_denied')
      throw new Error('the request was denied in the browser');
    else if (body.error === 'expired_token')
      throw new Error('the code expired; run `openscreenshot auth login` again');
    else if (body.error !== 'authorization_pending')
      throw new Error(`sign-in failed (${body.error ?? res.status})`);
  }

  const mint = await post(
    '/api/cli-key',
    { name: 'openscreenshot cli' },
    { authorization: `Bearer ${token}` },
  );
  if (!mint.ok) throw new Error(`could not mint key (${mint.status})`);
  const { key } = (await mint.json()) as { key: string };
  (deps.save ?? saveKey)(key);
  return key;
}

const FORMATS = new Set(['png', 'jpeg', 'webp', 'pdf', 'html', 'markdown']);
const EXT: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  pdf: 'pdf',
  html: 'html',
  markdown: 'md',
};

/** Render via OpenScreenShot Cloud. Returns the artifact bytes. */
export async function captureCloud(
  args: CaptureOptions & { format?: string; cloudKey?: string; cloudUrl?: string },
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
  stored: () => string | undefined = storedKey,
): Promise<Buffer> {
  const key = args.cloudKey ?? env.OPENSCREENSHOT_API_KEY ?? stored();
  if (!key)
    throw new Error(
      '--cloud needs an API key: --key, OPENSCREENSHOT_API_KEY, or `openscreenshot auth login`.',
    );
  const base = (
    args.cloudUrl ??
    env.OPENSCREENSHOT_CLOUD_URL ??
    'https://cloud.openscreenshot.app'
  ).replace(/\/$/, '');
  const format = FORMATS.has(args.format ?? '') ? args.format! : 'png';
  const res = await fetcher(`${base}/v1/screenshot`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      url: args.url,
      format,
      viewport_width: args.width,
      viewport_height: args.height,
      full_page: args.fullPage,
      // Cloud draws the same black boxes and fails the same way when a target is missed.
      ...(hasRedaction(args.redact) ? { redact: args.redact } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const p = (await res.json()) as { error?: { code?: string; message?: string } };
      detail = p.error?.message ?? p.error?.code ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`cloud render failed: ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function defaultOut(format: string | undefined): string {
  return `screenshot.${EXT[format ?? 'png'] ?? 'png'}`;
}

// MCP clients start the server over piped stdio with no arguments. A terminal with
// no arguments gets the usage instead of a process that waits for JSON-RPC.
export function isServerInvocation(argv: string[], stdinIsTTY: boolean | undefined): boolean {
  return argv[0] === 'serve' || (argv.length === 0 && !stdinIsTTY);
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function flags(argv: string[], name: string): string[] {
  return argv.flatMap((a, i) => (a === `--${name}` && i + 1 < argv.length ? [argv[i + 1]] : []));
}

export async function runCli(argv: string[]): Promise<number> {
  const [cmd, url] = argv;
  if (cmd === 'auth') {
    const sub = argv[1];
    const base = (
      flag(argv, 'cloud') ??
      process.env.OPENSCREENSHOT_CLOUD_URL ??
      'https://cloud.openscreenshot.app'
    ).replace(/\/$/, '');
    try {
      if (sub === 'login') {
        await deviceLogin(base);
        process.stdout.write('Signed in — API key stored at ~/.openscreenshot.json\n');
        return 0;
      }
      if (sub === 'logout') {
        if (existsSync(CONFIG)) unlinkSync(CONFIG);
        process.stdout.write('Signed out — stored key removed.\n');
        return 0;
      }
      process.stderr.write(USAGE);
      return 2;
    } catch (err) {
      process.stderr.write('auth failed: ' + String(err) + '\n');
      return 1;
    }
  }
  if (cmd !== 'shot' || !url) {
    process.stderr.write(USAGE);
    return 2;
  }
  const cloud = argv.includes('--cloud');
  const cloudBase = flag(argv, 'cloud');
  const parsed = CaptureOptions.safeParse({
    url,
    fullPage: argv.includes('--full'),
    width: flag(argv, 'width') ? Number(flag(argv, 'width')) : undefined,
    height: flag(argv, 'height') ? Number(flag(argv, 'height')) : undefined,
    redact: {
      selectors: flags(argv, 'redact'),
      patterns: flags(argv, 'redact-pattern').flatMap((p) => p.split(',')),
      rects: flags(argv, 'redact-rect').map((r) => {
        const [x, y, width, height] = r.split(',').map(Number);
        return { x, y, width, height };
      }),
    },
  });
  if (!parsed.success) {
    process.stderr.write(
      'invalid arguments: ' + parsed.error.issues.map((i) => i.message).join('; ') + '\n',
    );
    return 2;
  }
  try {
    const bytes = cloud
      ? await captureCloud({
          ...parsed.data,
          format: flag(argv, 'format'),
          cloudKey: flag(argv, 'key'),
          cloudUrl: cloudBase && !cloudBase.startsWith('--') ? cloudBase : undefined,
        })
      : await capture(parsed.data);
    const out = flag(argv, 'out') ?? defaultOut(cloud ? flag(argv, 'format') : 'png');
    if (out === '-') process.stdout.write(bytes);
    else writeFileSync(out, bytes);
    return 0;
  } catch (err) {
    process.stderr.write('capture failed: ' + String(err) + '\n');
    return 1;
  }
}
