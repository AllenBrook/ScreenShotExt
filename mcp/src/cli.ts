import { writeFileSync } from 'node:fs';
import { capture, CaptureOptions } from './capture.js';

const USAGE =
  'usage: openscreenshot shot <url> [--out file|-] [--full] [--width n] [--height n]\n' +
  '         [--redact selector]... [--redact-pattern email|phone|secret]... [--redact-rect x,y,w,h]...\n' +
  '       openscreenshot serve   MCP server over stdio; also the default with no arguments on a pipe\n';

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
    const png = await capture(parsed.data);
    const out = flag(argv, 'out') ?? 'screenshot.png';
    if (out === '-') process.stdout.write(png);
    else writeFileSync(out, png);
    return 0;
  } catch (err) {
    process.stderr.write('capture failed: ' + String(err) + '\n');
    return 1;
  }
}
