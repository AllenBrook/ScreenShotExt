import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { capture, CaptureOptions } from './capture.js';
import { captureCloud } from './cli.js';
import { Redact } from './redact.js';

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'openscreenshot', version: '2.5.1' });
  server.registerTool(
    'capture_screenshot',
    {
      description:
        'Capture a PNG screenshot of a public web page via the system Chrome, or on ' +
        'OpenScreenShot Cloud with cloud: true. ' +
        'Use redact to cover elements, text patterns, or rectangles with black boxes before ' +
        'the screenshot is taken, in either mode. The capture fails with no image if a selector ' +
        'matches nothing or the page changes during the capture.',
      inputSchema: {
        url: z.string().url(),
        fullPage: z.boolean().optional(),
        width: z.number().int().min(200).max(3840).optional(),
        height: z.number().int().min(200).max(2160).optional(),
        redact: Redact.optional(),
        cloud: z
          .boolean()
          .optional()
          .describe(
            'Render on OpenScreenShot Cloud instead of the local Chrome. Needs an API key from ' +
              '`openscreenshot auth login` or OPENSCREENSHOT_API_KEY.',
          ),
      },
    },
    async ({ cloud, ...args }) => {
      const options = CaptureOptions.parse(args);
      const png = cloud ? await captureCloud(options) : await capture(options);
      return {
        content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }],
      };
    },
  );
  return server;
}

export async function serve(): Promise<void> {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}
