# Spotler SendPro / FlowMailer MCP Server

[![npm version](https://img.shields.io/npm/v/sendpro-flowmailer-mcp.svg)](https://www.npmjs.com/package/sendpro-flowmailer-mcp)
[![CI](https://github.com/Mestika/sendpro-flowmailer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Mestika/sendpro-flowmailer-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933)](package.json)

Unofficial Model Context Protocol server for the Spotler SendPro API, formerly known as FlowMailer.

This project is not affiliated with, endorsed by, or maintained by Spotler. It is a community MCP server for teams that need controlled AI-agent access to SendPro account data and, when explicitly enabled, SendPro message operations.

<!-- mcp-name: io.github.mestika/sendpro-flowmailer-mcp -->

## What It Does

- Connects to SendPro over OAuth2 client credentials.
- Exposes SendPro operations as MCP tools over stdio.
- Defaults to read-only mode.
- Blocks mutating SendPro requests when read-only mode is enabled.
- Supports current SendPro naming plus legacy FlowMailer environment variables.
- Includes MCP Registry metadata in [server.json](server.json).

## Install

After npm publication:

```bash
npx -y sendpro-flowmailer-mcp
```

From GitHub:

```bash
npx -y github:Mestika/sendpro-flowmailer-mcp
```

Local development:

```bash
git clone https://github.com/Mestika/sendpro-flowmailer-mcp.git
cd sendpro-flowmailer-mcp
npm install
npm run build
node dist/index.js
```

## Configuration

Set credentials through your MCP client config, shell environment, or a local `.env` file.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SENDPRO_ACCOUNT_ID` | Yes | | SendPro account id. |
| `SENDPRO_CLIENT_ID` | Yes | | OAuth client id. |
| `SENDPRO_CLIENT_SECRET` | Yes | | OAuth client secret. |
| `SENDPRO_READ_ONLY` | No | `true` | Safe-mode flag. When true, only SendPro read requests are allowed. |
| `READ_ONLY` | No | | Generic override for `SENDPRO_READ_ONLY`; useful for shared MCP config conventions. |
| `SENDPRO_API_BASE_URL` | No | `https://api.flowmailer.net` | SendPro API base URL. |
| `SENDPRO_AUTH_BASE_URL` | No | `https://login.flowmailer.net` | OAuth base URL. |
| `SENDPRO_API_MEDIA_TYPE` | No | `application/vnd.flowmailer.v1.12+json` | SendPro vendor media type. |

Legacy aliases are supported:

| Current | Spotler alias | Legacy FlowMailer alias |
| --- | --- | --- |
| `SENDPRO_ACCOUNT_ID` | `SPOTLER_SENDPRO_ACCOUNT_ID` | `FLOWMAILER_ACCOUNT_ID` |
| `SENDPRO_CLIENT_ID` | `SPOTLER_SENDPRO_CLIENT_ID` | `FLOWMAILER_CLIENT_ID` |
| `SENDPRO_CLIENT_SECRET` | `SPOTLER_SENDPRO_CLIENT_SECRET` | `FLOWMAILER_CLIENT_SECRET` |
| `SENDPRO_READ_ONLY` | `SPOTLER_SENDPRO_READ_ONLY` | `FLOWMAILER_READ_ONLY` |

Precedence is: `READ_ONLY`, then `SENDPRO_*`, then `SPOTLER_SENDPRO_*`, then `FLOWMAILER_*`.

## Creating SendPro API Credentials

SendPro uses OAuth2 client credentials. You need three values:

- account id
- client id
- client secret

The public SendPro API docs state that the API uses OAuth2 client credentials, that the access token endpoint is `https://login.flowmailer.net/oauth/token`, and that the `client_id`, `client_secret`, `grant_type=client_credentials`, and optional `scope=api` form values are used to request a token. The same docs also expose source-system credential endpoints under `/{account_id}/sources/{source_id}/users`, including endpoints to list, create, get, update, and delete source credentials.

In the SendPro dashboard, the exact labels can vary by account, but the usual path is:

1. Sign in to Spotler SendPro.
2. Go to Setup.
3. Open Sources or Source systems.
4. Select the source system that should be used for API access, or create a dedicated source for MCP/automation usage.
5. Open the source credentials/users section.
6. Create new credentials with a clear description such as `MCP read-only`.
7. Copy the generated client id and client secret, and store them in your MCP client environment.
8. Use the SendPro account id from your account URL, dashboard context, or API settings as `SENDPRO_ACCOUNT_ID`.

For AI-agent usage, prefer credentials that are limited to the minimum access needed. Keep this MCP server in read-only mode unless you explicitly need submit, simulate, or resend operations.

Official references:

- [SendPro API authentication](https://flowmailer.com/apidoc/sendpro-api.html#_authentication)
- [POST `/oauth/token`](https://flowmailer.com/apidoc/sendpro-api.html#_post_oauth_token)
- [Source credential endpoints](https://flowmailer.com/apidoc/sendpro-api.html#_post_account_id_sources_source_id_users)
- [Spotler SendPro Help Center](https://sendpro.spotler.help/hc/en-gb)

## Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.sendpro_flowmailer]
command = "npx"
args = ["-y", "sendpro-flowmailer-mcp"]
startup_timeout_sec = 20.0

[mcp_servers.sendpro_flowmailer.env]
SENDPRO_ACCOUNT_ID = "your-account-id"
SENDPRO_CLIENT_ID = "your-client-id"
SENDPRO_CLIENT_SECRET = "your-client-secret"
SENDPRO_READ_ONLY = "true"
```

To run from GitHub before npm publication:

```toml
[mcp_servers.sendpro_flowmailer]
command = "npx"
args = ["-y", "github:Mestika/sendpro-flowmailer-mcp"]
startup_timeout_sec = 20.0
```

## Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sendpro-flowmailer": {
      "command": "npx",
      "args": ["-y", "sendpro-flowmailer-mcp"],
      "env": {
        "SENDPRO_ACCOUNT_ID": "your-account-id",
        "SENDPRO_CLIENT_ID": "your-client-id",
        "SENDPRO_CLIENT_SECRET": "your-client-secret",
        "SENDPRO_READ_ONLY": "true"
      }
    }
  }
}
```

## Read-Only Mode

`SENDPRO_READ_ONLY` defaults to `true`.

When read-only mode is enabled:

- MCP schemas only allow `GET` for the generic request tool.
- Mutating helper tools are not registered.
- The low-level client rejects `POST`, `PUT`, `PATCH`, and `DELETE` SendPro API requests before requesting an OAuth token.

OAuth itself still uses `POST https://login.flowmailer.net/oauth/token`, because SendPro requires OAuth2 client credentials before any resource can be read. The read-only guard applies to SendPro API resource calls against the configured API base URL.

## Tools

Read tools:

| Tool | Description |
| --- | --- |
| `flowmailer_request` | Generic relative SendPro API request. In read-only mode, only `GET` is accepted. |
| `flowmailer_endpoint_catalog` | Lists SendPro endpoints known by this server. |
| `flowmailer_list_messages` | Lists messages using SendPro reference-range paging. |
| `flowmailer_get_message` | Gets one message by id. |
| `flowmailer_get_message_archive` | Gets archived content metadata for a message. |
| `flowmailer_get_message_error_archive` | Gets archived error content for a message. |
| `flowmailer_get_recipient` | Gets recipient information. |
| `flowmailer_list_resource` | Lists common resources such as flows, templates, sender domains, sources, and stats. |

Write tools, only when `SENDPRO_READ_ONLY=false`:

| Tool | Description |
| --- | --- |
| `flowmailer_submit_message` | Submits an email or SMS message. |
| `flowmailer_simulate_message` | Simulates an email or SMS message. |
| `flowmailer_resend_message` | Resends a message by id. |

The tool names currently retain the FlowMailer prefix because the public SendPro API and media types still use FlowMailer naming in several places. Package names and documentation use both SendPro and FlowMailer for discoverability.

## Examples

List messages:

```json
{
  "method": "GET",
  "path": "/{account_id}/messages",
  "matrix": {
    "daterange": "2026-05-01T00:00:00Z,2026-05-20T00:00:00Z"
  },
  "query": {
    "addevents": true,
    "sortfield": "INSERTED",
    "sortorder": "ASC"
  },
  "range": "items=:10"
}
```

List flows through the convenience tool:

```json
{
  "resource": "flows"
}
```

Submit a message, only with `SENDPRO_READ_ONLY=false`:

```json
{
  "body": {
    "messageType": "EMAIL",
    "headerFromAddress": "sender@example.com",
    "headerToAddress": "recipient@example.com",
    "subject": "Hello",
    "text": "Message body"
  }
}
```

## Development

```bash
npm install
npm run check
```

Useful commands:

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run inspect
```

## Publishing

This repository is prepared for npm and MCP Registry publication.

For npm:

```bash
npm publish --access public --provenance
```

For the official MCP Registry, publish [server.json](server.json) after the npm package exists. The npm package includes:

```json
{
  "mcpName": "io.github.mestika/sendpro-flowmailer-mcp"
}
```

## Security

Never commit real SendPro credentials. Use MCP client environment variables, shell environment variables, or a local `.env` file.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and operational notes.

## License

MIT. See [LICENSE](LICENSE).
