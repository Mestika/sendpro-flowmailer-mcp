# Security Policy

## Supported Versions

Security fixes target the latest published version.

## Reporting a Vulnerability

Please report security issues privately when possible. If GitHub private vulnerability reporting is enabled for the repository, use that flow. Otherwise, open a minimal issue that does not include exploit details, credentials, message contents, recipient data, or customer data.

## Operational Security

- Keep `SENDPRO_READ_ONLY=true` unless an MCP client genuinely needs to submit, simulate, or resend messages.
- Prefer read-only SendPro API credentials for routine AI-agent access.
- Do not commit `.env` files or MCP client configs containing credentials.
- Treat MCP tool output as potentially sensitive because SendPro responses can contain operational account data.
- This project rejects absolute and protocol-relative API paths so configured credentials are not sent to arbitrary hosts.

## Unofficial Project

This project is not affiliated with, endorsed by, or maintained by Spotler. For account security, permissions, or official API support, contact Spotler.
