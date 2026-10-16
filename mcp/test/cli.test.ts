import { expect, test } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { isServerInvocation, runCli } from '../src/cli';

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
