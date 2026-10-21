# auth.md

OpenScreenShot's agent tooling runs **locally** on your machine by default. Local
use needs no authentication. The operator's own machine is the trust boundary.

OpenScreenShot Cloud (https://cloud.openscreenshot.app) is a separate, optional
hosted screenshot API. It uses an API key.

- Agent audience: coding/automation agents that need screenshots.
- Usage: run `openscreenshot serve` as an MCP stdio server, or `shot <url>` as a CLI.
  Add `--cloud` (CLI) or `cloud: true` (MCP) to render on OpenScreenShot Cloud.

## Registration

Local use needs no registration, provisioning, or credentials. Install
`openscreenshot` (npm) and run it.

For Cloud, run `openscreenshot auth login`. It prints a code and opens
https://cloud.openscreenshot.app/device. The user signs in with an emailed code
and approves. The CLI stores the API key in `~/.openscreenshot.json`.

## Methods Supported

- Local tooling and public resources on openscreenshot.app: none.
- OpenScreenShot Cloud: API key as a bearer token (`Authorization: Bearer <key>`).

## Credential Usage

Local captures need no credential. Public resources on openscreenshot.app require
no token.

The CLI and MCP server send a Cloud API key only in Cloud mode. They take the
key from `--key`, then `OPENSCREENSHOT_API_KEY`, then the key that
`auth login` stored. The remote MCP endpoint https://cloud.openscreenshot.app/mcp
takes the same bearer key. Docs: https://cloud.openscreenshot.app/docs
