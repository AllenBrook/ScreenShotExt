#!/usr/bin/env node
import { isServerInvocation, runCli } from './cli.js';
import { serve } from './serve.js';

const argv = process.argv.slice(2);
if (isServerInvocation(argv, process.stdin.isTTY)) {
  // MCP clients log stderr and ignore it for the protocol. A script that waits here
  // by mistake shows this line in its log.
  process.stderr.write(
    'openscreenshot: MCP server on stdio. For the CLI, run: openscreenshot shot <url>\n',
  );
  serve().catch((e) => {
    process.stderr.write(String(e) + '\n');
    process.exit(1);
  });
} else {
  runCli(argv).then((code) => process.exit(code));
}
