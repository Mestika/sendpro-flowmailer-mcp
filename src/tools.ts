import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FlowMailerConfig } from "./config.js";
import type { FlowMailerClient, FlowMailerRequest, FlowMailerResponse, HttpMethod } from "./flowmailer-client.js";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  readOnly: boolean;
}

export interface KnownEndpoint {
  method: HttpMethod;
  path: string;
  description: string;
  mutates: boolean;
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);
const objectSchema = z.record(z.string(), jsonValueSchema);
const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const accountIdSchema = z.string().min(1).optional().describe("Override FLOWMAILER_ACCOUNT_ID for this call.");

const requestSchema = z.object({
  method: methodSchema.default("GET"),
  path: z
    .string()
    .min(1)
    .describe("Relative SendPro API path, e.g. /{account_id}/messages or /545/messages. Absolute URLs are rejected."),
  accountId: accountIdSchema,
  matrix: objectSchema.optional().describe("Matrix parameters appended to the final path segment, e.g. daterange."),
  query: objectSchema.optional().describe("Query string parameters."),
  body: jsonValueSchema.optional().describe("JSON request body for mutating API calls."),
  range: z.string().optional().describe("Range header, e.g. items=:10 or items=0-10.")
});
const readOnlyRequestSchema = requestSchema.extend({
  method: z.literal("GET").default("GET")
});

const listMessagesSchema = z.object({
  accountId: accountIdSchema,
  count: z.number().int().positive().max(1000).default(10).describe("Number of messages for the ref_range header."),
  reference: z.string().optional().describe("Reference token from Next-Range. Omit for the first page."),
  daterange: z.string().optional().describe("ISO8601 date range: start,end."),
  flowIds: z.array(z.string()).optional().describe("Flow IDs to filter on."),
  addEvents: z.boolean().optional(),
  addHeaders: z.boolean().optional(),
  addOnlineLink: z.boolean().optional(),
  addTags: z.boolean().optional(),
  sortField: z.enum(["INSERTED", "SUBMITTED"]).optional(),
  sortOrder: z.enum(["ASC", "DESC"]).optional()
});

const messageIdSchema = z.object({
  accountId: accountIdSchema,
  messageId: z.string().min(1),
  addTags: z.boolean().optional()
});

const archiveSchema = z.object({
  accountId: accountIdSchema,
  messageId: z.string().min(1),
  addAttachments: z.boolean().optional(),
  addData: z.boolean().optional()
});

const recipientSchema = z.object({
  accountId: accountIdSchema,
  recipient: z.string().min(1)
});

const listResourceSchema = z.object({
  accountId: accountIdSchema,
  resource: z.enum([
    "event_flow_rules",
    "event_flow_rules/hierarchy",
    "event_flows",
    "filters",
    "flow_rules",
    "flow_templates",
    "flows",
    "message_events",
    "message_hold",
    "messagestats",
    "sender_domains",
    "sources",
    "templates",
    "undeliveredmessages"
  ]),
  daterange: z.string().optional().describe("Matrix daterange where the selected endpoint supports it."),
  range: z.string().optional().describe("Range header where the selected endpoint supports it.")
});

const submitMessageSchema = z.object({
  accountId: accountIdSchema,
  body: objectSchema.describe("SendPro SubmitMessage JSON body.")
});

const resendMessageSchema = z.object({
  accountId: accountIdSchema,
  messageId: z.string().min(1),
  body: objectSchema.describe("SendPro ResendMessage JSON body.")
});

export function listKnownEndpoints(): KnownEndpoint[] {
  return KNOWN_ENDPOINTS;
}

export function listToolNames(options: { readOnly: boolean }): string[] {
  return getToolDefinitions(options).map((tool) => tool.name);
}

export function registerTools(server: McpServer, client: FlowMailerClient, config: FlowMailerConfig): void {
  const handlers = createToolHandlers(client, config);

  for (const tool of getToolDefinitions(config)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: !tool.readOnly,
          openWorldHint: true
        }
      },
      async (args) => handlers[tool.name]?.(args as Record<string, unknown>)
    );
  }
}

export function createToolHandlers(client: FlowMailerClient, config: FlowMailerConfig): Record<string, ToolHandler> {
  return {
    flowmailer_request: async (args) => toToolResult(await client.request(toRawRequest(args))),
    flowmailer_endpoint_catalog: async () =>
      toToolResult({
        status: 200,
        headers: {},
        data: { endpoints: KNOWN_ENDPOINTS }
      }),
    flowmailer_list_messages: async (args) =>
      toToolResult(
        await client.request({
          method: "GET",
          path: "/{account_id}/messages",
          accountId: args.accountId as string | undefined,
          matrix: {
            daterange: args.daterange as string | undefined,
            flow_ids: args.flowIds as string[] | undefined
          },
          query: {
            addevents: args.addEvents as boolean | undefined,
            addheaders: args.addHeaders as boolean | undefined,
            addonlinelink: args.addOnlineLink as boolean | undefined,
            addtags: args.addTags as boolean | undefined,
            sortfield: args.sortField as string | undefined,
            sortorder: args.sortOrder as string | undefined
          },
          range: buildReferenceRange(args.reference as string | undefined, args.count as number | undefined)
        })
      ),
    flowmailer_get_message: async (args) =>
      toToolResult(
        await client.request({
          method: "GET",
          path: "/{account_id}/messages/{message_id}".replace("{message_id}", encodeURIComponent(args.messageId as string)),
          accountId: args.accountId as string | undefined,
          query: {
            addtags: args.addTags as boolean | undefined
          }
        })
      ),
    flowmailer_get_message_archive: async (args) =>
      toToolResult(
        await client.request({
          method: "GET",
          path: "/{account_id}/messages/{message_id}/archive".replace(
            "{message_id}",
            encodeURIComponent(args.messageId as string)
          ),
          accountId: args.accountId as string | undefined,
          query: {
            addattachments: args.addAttachments as boolean | undefined,
            adddata: args.addData as boolean | undefined
          }
        })
      ),
    flowmailer_get_message_error_archive: async (args) =>
      toToolResult(
        await client.request({
          method: "GET",
          path: "/{account_id}/messages/{message_id}/error_archive".replace(
            "{message_id}",
            encodeURIComponent(args.messageId as string)
          ),
          accountId: args.accountId as string | undefined,
          query: {
            addattachments: args.addAttachments as boolean | undefined,
            adddata: args.addData as boolean | undefined
          }
        })
      ),
    flowmailer_get_recipient: async (args) =>
      toToolResult(
        await client.request({
          method: "GET",
          path: "/{account_id}/recipient/{recipient}".replace("{recipient}", encodeURIComponent(args.recipient as string)),
          accountId: args.accountId as string | undefined
        })
      ),
    flowmailer_list_resource: async (args) =>
      toToolResult(
        await client.request({
          method: "GET",
          path: `/{account_id}/${args.resource as string}`,
          accountId: args.accountId as string | undefined,
          matrix: {
            daterange: args.daterange as string | undefined
          },
          range: args.range as string | undefined
        })
      ),
    flowmailer_submit_message: async (args) => {
      assertWritable(config);
      return toToolResult(
        await client.request({
          method: "POST",
          path: "/{account_id}/messages/submit",
          accountId: args.accountId as string | undefined,
          body: args.body
        })
      );
    },
    flowmailer_simulate_message: async (args) => {
      assertWritable(config);
      return toToolResult(
        await client.request({
          method: "POST",
          path: "/{account_id}/messages/simulate",
          accountId: args.accountId as string | undefined,
          body: args.body
        })
      );
    },
    flowmailer_resend_message: async (args) => {
      assertWritable(config);
      return toToolResult(
        await client.request({
          method: "POST",
          path: "/{account_id}/messages/{message_id}/resend".replace(
            "{message_id}",
            encodeURIComponent(args.messageId as string)
          ),
          accountId: args.accountId as string | undefined,
          body: args.body
        })
      );
    }
  };
}

function getToolDefinitions(options: { readOnly: boolean }): ToolDefinition[] {
  const readTools: ToolDefinition[] = [
    {
      name: "flowmailer_request",
      title: "FlowMailer Request",
      description:
        "Call any relative FlowMailer SendPro API endpoint. In READ_ONLY mode, only GET requests are allowed.",
      inputSchema: options.readOnly ? readOnlyRequestSchema : requestSchema,
      readOnly: options.readOnly
    },
    {
      name: "flowmailer_endpoint_catalog",
      title: "FlowMailer Endpoint Catalog",
      description: "List the SendPro endpoints known by this unofficial MCP server.",
      inputSchema: z.object({}),
      readOnly: true
    },
    {
      name: "flowmailer_list_messages",
      title: "List FlowMailer Messages",
      description: "List messages using SendPro's reference range paging.",
      inputSchema: listMessagesSchema,
      readOnly: true
    },
    {
      name: "flowmailer_get_message",
      title: "Get FlowMailer Message",
      description: "Get a SendPro message by id.",
      inputSchema: messageIdSchema,
      readOnly: true
    },
    {
      name: "flowmailer_get_message_archive",
      title: "Get Message Archive",
      description: "List archived message content for a message.",
      inputSchema: archiveSchema,
      readOnly: true
    },
    {
      name: "flowmailer_get_message_error_archive",
      title: "Get Message Error Archive",
      description: "Get archived error content for a message.",
      inputSchema: archiveSchema,
      readOnly: true
    },
    {
      name: "flowmailer_get_recipient",
      title: "Get Recipient",
      description: "Get SendPro recipient information.",
      inputSchema: recipientSchema,
      readOnly: true
    },
    {
      name: "flowmailer_list_resource",
      title: "List FlowMailer Resource",
      description: "List common account resources such as flows, templates, sources, sender domains, or stats.",
      inputSchema: listResourceSchema,
      readOnly: true
    }
  ];

  if (options.readOnly) {
    return readTools;
  }

  return [
    ...readTools,
    {
      name: "flowmailer_submit_message",
      title: "Submit FlowMailer Message",
      description: "Submit an email or SMS message via SendPro.",
      inputSchema: submitMessageSchema,
      readOnly: false
    },
    {
      name: "flowmailer_simulate_message",
      title: "Simulate FlowMailer Message",
      description: "Simulate an email or SMS message via SendPro.",
      inputSchema: submitMessageSchema,
      readOnly: false
    },
    {
      name: "flowmailer_resend_message",
      title: "Resend FlowMailer Message",
      description: "Resend a SendPro message by id.",
      inputSchema: resendMessageSchema,
      readOnly: false
    }
  ];
}

function toRawRequest(args: Record<string, unknown>): FlowMailerRequest {
  return {
    method: (args.method as HttpMethod | undefined) ?? "GET",
    path: args.path as string,
    accountId: args.accountId as string | undefined,
    matrix: args.matrix as FlowMailerRequest["matrix"],
    query: args.query as FlowMailerRequest["query"],
    body: args.body,
    range: args.range as string | undefined
  };
}

function toToolResult(response: FlowMailerResponse): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2)
      }
    ],
    structuredContent: response as unknown as Record<string, unknown>
  };
}

function buildReferenceRange(reference: string | undefined, count = 10): string {
  return reference ? `items=${reference}:${count}` : `items=:${count}`;
}

function assertWritable(config: FlowMailerConfig): void {
  if (config.readOnly) {
    throw new Error("READ_ONLY is enabled; mutating FlowMailer tools are disabled");
  }
}

const KNOWN_ENDPOINTS: KnownEndpoint[] = [
  { method: "GET", path: "/{account_id}/event_flow_rules", description: "Get flow rule list for all event flows", mutates: false },
  { method: "GET", path: "/{account_id}/event_flow_rules/hierarchy", description: "Get hierarchical flow rule list for all event flows", mutates: false },
  { method: "GET", path: "/{account_id}/event_flows", description: "List event flows per account", mutates: false },
  { method: "POST", path: "/{account_id}/event_flows", description: "Create a new event flow", mutates: true },
  { method: "DELETE", path: "/{account_id}/event_flows/{event_flow_id}", description: "Delete event flow by id", mutates: true },
  { method: "GET", path: "/{account_id}/event_flows/{event_flow_id}", description: "Get event flow by id", mutates: false },
  { method: "PUT", path: "/{account_id}/event_flows/{event_flow_id}", description: "Save event flow", mutates: true },
  { method: "GET", path: "/{account_id}/event_flows/{event_flow_id}/rule", description: "Get conditions for an event flow", mutates: false },
  { method: "PUT", path: "/{account_id}/event_flows/{event_flow_id}/rule", description: "Set conditions for an event flow", mutates: true },
  { method: "GET", path: "/{account_id}/filters", description: "List filters per account", mutates: false },
  { method: "DELETE", path: "/{account_id}/filters/{filter_id}", description: "Delete a recipient from the filter", mutates: true },
  { method: "GET", path: "/{account_id}/flow_rules", description: "Get flow rule list for all flows", mutates: false },
  { method: "GET", path: "/{account_id}/flow_templates", description: "List flow templates per account", mutates: false },
  { method: "GET", path: "/{account_id}/flows", description: "List flows per account", mutates: false },
  { method: "POST", path: "/{account_id}/flows", description: "Create a new flow", mutates: true },
  { method: "DELETE", path: "/{account_id}/flows/{flow_id}", description: "Delete flow by id", mutates: true },
  { method: "GET", path: "/{account_id}/flows/{flow_id}", description: "Get flow by id", mutates: false },
  { method: "PUT", path: "/{account_id}/flows/{flow_id}", description: "Save flow", mutates: true },
  { method: "GET", path: "/{account_id}/flows/{flow_id}/messages", description: "List messages per flow", mutates: false },
  { method: "GET", path: "/{account_id}/flows/{flow_id}/rule", description: "Get flow conditions for a flow", mutates: false },
  { method: "PUT", path: "/{account_id}/flows/{flow_id}/rule", description: "Set conditions for a flow", mutates: true },
  { method: "GET", path: "/{account_id}/flows/{flow_id}/stats", description: "Get time-based message statistics for a flow", mutates: false },
  { method: "GET", path: "/{account_id}/message_events", description: "List message events", mutates: false },
  { method: "GET", path: "/{account_id}/message_hold", description: "List messages which could not be processed", mutates: false },
  { method: "GET", path: "/{account_id}/message_hold/{message_id}", description: "Get a held message by id", mutates: false },
  { method: "GET", path: "/{account_id}/messages", description: "List messages", mutates: false },
  { method: "POST", path: "/{account_id}/messages/simulate", description: "Simulate an email or SMS message", mutates: true },
  { method: "POST", path: "/{account_id}/messages/submit", description: "Send an email or SMS message", mutates: true },
  { method: "GET", path: "/{account_id}/messages/{message_id}", description: "Get message by id", mutates: false },
  { method: "GET", path: "/{account_id}/messages/{message_id}/archive", description: "List archived message content", mutates: false },
  { method: "GET", path: "/{account_id}/messages/{message_id}/archive/{flow_step_id}/attachment/{content_id}", description: "Fetch an archived attachment", mutates: false },
  { method: "GET", path: "/{account_id}/messages/{message_id}/error_archive", description: "Get message error archive", mutates: false },
  { method: "POST", path: "/{account_id}/messages/{message_id}/resend", description: "Resend message by id", mutates: true },
  { method: "GET", path: "/{account_id}/messagestats", description: "Get time-based message statistics for the account", mutates: false },
  { method: "GET", path: "/{account_id}/recipient/{recipient}", description: "Get information about a recipient", mutates: false },
  { method: "GET", path: "/{account_id}/recipient/{recipient}/messages", description: "List messages per recipient", mutates: false },
  { method: "GET", path: "/{account_id}/sender/{sender}/messages", description: "List messages per sender", mutates: false },
  { method: "GET", path: "/{account_id}/sender_domains", description: "List sender domains by account", mutates: false },
  { method: "POST", path: "/{account_id}/sender_domains", description: "Create sender domain", mutates: true },
  { method: "GET", path: "/{account_id}/sender_domains/by_domain/{domain}", description: "Get sender domain by domain name", mutates: false },
  { method: "POST", path: "/{account_id}/sender_domains/validate", description: "Validate but do not save a sender domain", mutates: true },
  { method: "DELETE", path: "/{account_id}/sender_domains/{domain_id}", description: "Delete sender domain", mutates: true },
  { method: "GET", path: "/{account_id}/sender_domains/{domain_id}", description: "Get sender domain by id", mutates: false },
  { method: "PUT", path: "/{account_id}/sender_domains/{domain_id}", description: "Save sender domain", mutates: true },
  { method: "GET", path: "/{account_id}/sources", description: "List source systems per account", mutates: false },
  { method: "POST", path: "/{account_id}/sources", description: "Create a new source", mutates: true },
  { method: "DELETE", path: "/{account_id}/sources/{source_id}", description: "Delete a source", mutates: true },
  { method: "GET", path: "/{account_id}/sources/{source_id}", description: "Get a source by id", mutates: false },
  { method: "PUT", path: "/{account_id}/sources/{source_id}", description: "Update a source", mutates: true },
  { method: "GET", path: "/{account_id}/sources/{source_id}/messages", description: "List messages per source", mutates: false },
  { method: "GET", path: "/{account_id}/sources/{source_id}/stats", description: "Get source statistics", mutates: false },
  { method: "GET", path: "/{account_id}/sources/{source_id}/users", description: "List credentials per source system", mutates: false },
  { method: "POST", path: "/{account_id}/sources/{source_id}/users", description: "Create credentials for a source", mutates: true },
  { method: "DELETE", path: "/{account_id}/sources/{source_id}/users/{user_id}", description: "Delete credentials", mutates: true },
  { method: "GET", path: "/{account_id}/sources/{source_id}/users/{user_id}", description: "Get credentials for a source", mutates: false },
  { method: "PUT", path: "/{account_id}/sources/{source_id}/users/{user_id}", description: "Update credentials for a source", mutates: true },
  { method: "GET", path: "/{account_id}/tag/{tag}/messages", description: "List messages per tag", mutates: false },
  { method: "GET", path: "/{account_id}/templates", description: "List templates by account", mutates: false },
  { method: "POST", path: "/{account_id}/templates", description: "Create template", mutates: true },
  { method: "DELETE", path: "/{account_id}/templates/{template_id}", description: "Delete template by id", mutates: true },
  { method: "GET", path: "/{account_id}/templates/{template_id}", description: "Get template by id", mutates: false },
  { method: "PUT", path: "/{account_id}/templates/{template_id}", description: "Save template", mutates: true },
  { method: "GET", path: "/{account_id}/undeliveredmessages", description: "List undeliverable messages", mutates: false }
];
