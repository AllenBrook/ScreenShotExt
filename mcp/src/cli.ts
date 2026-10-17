import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { capture, CaptureOptions } from './capture.js';

const USAGE =
  'usage: openscreenshot shot <url> [--out file|-] [--full] [--width n] [--height n]\n' +
  '         [--redact selector]... [--redact-pattern email|phone|secret]... [--redact-rect x,y,w,h]...\n' +
  '         [--cloud [base-url]] [--key osc_live_…] [--format png|jpeg|webp|pdf|html|markdown]\n' +
  '         --cloud renders through OpenScreenShot Cloud instead of local Chrome.\n' +
  '         Auth order: --key, OPENSCREENSHOT_API_KEY, key stored by `auth login`.\n' +
  '         Base URL: --cloud <url> or OPENSCREENSHOT_CLOUD_URL\n' +
  '         (default https://cloud.openscreenshot.app).\n' +
  '       openscreenshot auth login --email you@x.com [--code 123456] [--cloud <url>]\n' +
  '         Sends an email code, then mints an API key stored at ~/.openscreenshot.json.\n' +
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

/** `auth login` two-step: send the email OTP, then verify + mint a CLI key. */
async function authLogin(
  email: string,
  code: string | undefined,
  base: string,
  fetcher: typeof fetch = fetch,
): Promise<{ step: 'sent' | 'done'; key?: string }> {
  if (!code) {
    const res = await fetcher(`${base}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    });
    if (!res.ok) throw new Error(`could not send code (${res.status})`);
    return { step: 'sent' };
  }
  const signin = await fetcher(`${base}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, otp: code }),
  });
  if (!signin.ok) throw new Error(`code rejected (${signin.status})`);
  const cookie = signin.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('sign-in returned no session cookie');
  const mint = await fetcher(`${base}/api/cli-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'openscreenshot cli' }),
  });
  if (!mint.ok) throw new Error(`could not mint key (${mint.status})`);
  const { key } = (await mint.json()) as { key: string };
  mkdirSync(join(homedir(), '.config'), { recursive: true });
  writeFileSync(CONFIG, JSON.stringify({ key, created_at: Date.now() }, null, 2) + '\n', {
    mode: 0o600,
  });
  return { step: 'done', key };
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
): Promise<Buffer> {
  const key = args.cloudKey ?? env.OPENSCREENSHOT_API_KEY ?? storedKey();
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
      width: args.width,
      height: args.height,
      full_page: args.fullPage,
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
        const email = flag(argv, 'email');
        if (!email) {
          process.stderr.write('auth login needs --email\n');
          return 2;
        }
        const r = await authLogin(email, flag(argv, 'code'), base);
        process.stdout.write(
          r.step === 'sent'
            ? `Code sent to ${email} — run again with --code.\n`
            : 'Signed in — API key stored at ~/.openscreenshot.json\n',
        );
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
