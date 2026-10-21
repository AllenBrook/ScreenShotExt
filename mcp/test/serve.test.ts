import { expect, test, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/serve';

test('server exposes capture_screenshot', async () => {
  const server = buildServer();
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name)).toContain('capture_screenshot');
  await client.close();
});

test('capture_screenshot with cloud renders on OpenScreenShot Cloud', async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubEnv('OPENSCREENSHOT_API_KEY', 'osc_test_k');
  vi.stubEnv('OPENSCREENSHOT_CLOUD_URL', 'https://cloud.test');
  vi.stubGlobal('fetch', async (url: unknown, init: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  });
  const server = buildServer();
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  const result = await client.callTool({
    name: 'capture_screenshot',
    arguments: { url: 'https://example.com', cloud: true, redact: { patterns: ['email'] } },
  });
  expect(result.isError).toBeFalsy();
  expect((result.content as { type: string; mimeType: string }[])[0]).toMatchObject({
    type: 'image',
    mimeType: 'image/png',
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://cloud.test/v1/screenshot');
  expect(requests[0].body).toMatchObject({
    url: 'https://example.com',
    format: 'png',
    redact: { patterns: ['email'] },
  });
  await client.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
