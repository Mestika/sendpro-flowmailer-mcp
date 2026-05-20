# Contributing

Thanks for helping improve this unofficial Spotler SendPro / FlowMailer MCP server.

## Ground Rules

- Do not include real SendPro credentials, message contents, recipient data, or customer data in issues, tests, commits, or logs.
- Keep the server safe by default. Read-only behavior must remain the default.
- Add or update tests for behavior changes.
- Prefer small pull requests with a clear description and verification notes.

## Development

```bash
npm install
npm run check
```

Use the MCP Inspector while developing:

```bash
npm run inspect
```

## Pull Requests

Before opening a pull request:

1. Run `npm run check`.
2. Confirm no secrets are present with a local search.
3. Update README or docs when configuration, tools, or behavior changes.
4. Update `server.json` when package metadata changes.

## Release Notes

User-facing changes should be reflected in [CHANGELOG.md](CHANGELOG.md).
