# Configuration

The server reads configuration from environment variables. Values passed by an MCP client take precedence over `.env` files loaded by `dotenv`.

## Required

| Variable | Description |
| --- | --- |
| `SENDPRO_ACCOUNT_ID` | SendPro account id. |
| `SENDPRO_CLIENT_ID` | OAuth client id. |
| `SENDPRO_CLIENT_SECRET` | OAuth client secret. |

## Optional

| Variable | Default | Description |
| --- | --- | --- |
| `SENDPRO_READ_ONLY` | `true` | Allows only read requests when true. |
| `READ_ONLY` | | Generic read-only override. |
| `SENDPRO_API_BASE_URL` | `https://api.flowmailer.net` | SendPro API base URL. |
| `SENDPRO_AUTH_BASE_URL` | `https://login.flowmailer.net` | OAuth base URL. |
| `SENDPRO_API_MEDIA_TYPE` | `application/vnd.flowmailer.v1.12+json` | SendPro vendor media type. |

## Aliases

`SPOTLER_SENDPRO_*` and legacy `FLOWMAILER_*` aliases are supported for credential and read-only variables.
