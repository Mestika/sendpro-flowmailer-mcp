# Tools

The server exposes tools over MCP stdio.

## Read Tools

- `flowmailer_request`
- `flowmailer_endpoint_catalog`
- `flowmailer_list_messages`
- `flowmailer_get_message`
- `flowmailer_get_message_archive`
- `flowmailer_get_message_error_archive`
- `flowmailer_get_recipient`
- `flowmailer_list_resource`

## Write Tools

Write tools are registered only when `SENDPRO_READ_ONLY=false`.

- `flowmailer_submit_message`
- `flowmailer_simulate_message`
- `flowmailer_resend_message`

## Generic Requests

Use `flowmailer_request` for endpoints not yet covered by a convenience tool. The path must be relative and start with `/`.

In read-only mode the generic request schema only accepts:

```json
{
  "method": "GET"
}
```
