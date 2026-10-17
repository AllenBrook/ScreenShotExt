import { writeFileSync } from 'node:fs';
import { capture, CaptureOptions } from './capture.js';

const USAGE =
  'usage: openscreenshot shot <url> [--out file|-] [--full] [--width n] [--height n]\n' +
  '         [--redact selector]... [--redact-pattern email|phone|secret]... [--redact-rect x,y,w,h]...\n' +
  '         [--cloud [base-url]] [--key osc_live_…] [--format png|jpeg|webp|pdf|html|markdown]\n' +
  '         --cloud renders through OpenScreenShot Cloud instead of local Chrome.\n' +
  '         Auth: --key or OPENSCREENSHOT_API_KEY. Base URL: --cloud <url> or\n' +
  '         OPENSCREENSHOT_CLOUD_URL (default https://cloud.openscreenshot.app).\n' +
  '       openscreenshot serve   MCP server over stdio; also the default with no arguments on a pipe\n';

const FORMATS = new Set(['png', 'jpeg', 'webp', 'pdf', 'html', 'markdown']);
const EXT: Record<string, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', pdf: 'pdf', html: 'html', markdown: 'md' };

/** Render via OpenScreenShot Cloud. Returns the artifact bytes. */
export async function captureCloud(
  args: CaptureOptions & { format?: string; cloudKey?: string; cloudUrl?: string },
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Buffer> {
  const key = args.cloudKey ?? env.OPENSCREENSHOT_API_KEY;
  if (!key)
    throw new Error('--cloud needs an API key: pass --key or set OPENSCREENSHOT_API_KEY (dashboard → API keys).');
  const base = (args.cloudUrl ?? env.OPENSCREENSHOT_CLOUD_URL ?? 'https://cloud.openscreenshot.app').replace(/\/$/, '');
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
    } catch { /* non-JSON error body */ }
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
