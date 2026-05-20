import { describe, expect, test, vi } from "vitest";
import { FlowMailerClient } from "../src/flowmailer-client.js";
import { createToolHandlers, listKnownEndpoints, listToolNames } from "../src/tools.js";
import type { FlowMailerConfig } from "../src/config.js";

const config: FlowMailerConfig = {
  accountId: "545",
  clientId: "client-id",
  clientSecret: "client-secret",
  readOnly: true,
  apiBaseUrl: "https://api.flowmailer.net",
  authBaseUrl: "https://login.flowmailer.net",
  apiMediaType: "application/vnd.flowmailer.v1.12+json"
};

describe("tools", () => {
  test("omits mutating helpers when read-only mode is enabled", () => {
    expect(listToolNames({ readOnly: true })).toContain("flowmailer_request");
    expect(listToolNames({ readOnly: true })).not.toContain("flowmailer_submit_message");
    expect(listToolNames({ readOnly: false })).toContain("flowmailer_submit_message");
  });

  test("exposes a compact catalog of SendPro endpoints with mutating methods marked", () => {
    expect(listKnownEndpoints()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/{account_id}/messages" }),
        expect.objectContaining({ method: "POST", path: "/{account_id}/messages/submit", mutates: true }),
        expect.objectContaining({ method: "DELETE", path: "/{account_id}/templates/{template_id}", mutates: true })
      ])
    );
  });

  test("list messages helper maps friendly inputs to SendPro request parameters", async () => {
    const client = new FlowMailerClient(config, vi.fn<typeof fetch>());
    const request = vi.spyOn(client, "request").mockResolvedValue({
      status: 206,
      headers: { "next-range": "items=next:10" },
      data: [{ id: "message-1" }]
    });
    const handlers = createToolHandlers(client, config);

    const result = await handlers.flowmailer_list_messages({
      count: 10,
      reference: "abc",
      daterange: "2024-03-01T00:00:00Z,2024-05-01T00:00:00Z",
      flowIds: ["16801"],
      addEvents: true,
      sortField: "INSERTED",
      sortOrder: "ASC"
    });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/{account_id}/messages",
      accountId: undefined,
      matrix: {
        daterange: "2024-03-01T00:00:00Z,2024-05-01T00:00:00Z",
        flow_ids: ["16801"]
      },
      query: {
        addevents: true,
        addheaders: undefined,
        addonlinelink: undefined,
        addtags: undefined,
        sortfield: "INSERTED",
        sortorder: "ASC"
      },
      range: "items=abc:10"
    });
    expect(result.structuredContent).toEqual({
      status: 206,
      headers: { "next-range": "items=next:10" },
      data: [{ id: "message-1" }]
    });
  });

  test("submit helper calls the SendPro submit endpoint", async () => {
    const writableConfig = { ...config, readOnly: false };
    const client = new FlowMailerClient(writableConfig, vi.fn<typeof fetch>());
    const request = vi.spyOn(client, "request").mockResolvedValue({
      status: 201,
      headers: { location: "https://api.flowmailer.net/545/messages/new-id" },
      data: undefined
    });
    const handlers = createToolHandlers(client, writableConfig);

    await handlers.flowmailer_submit_message({
      body: {
        messageType: "EMAIL",
        headerToAddress: "user@example.com"
      }
    });

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/{account_id}/messages/submit",
      accountId: undefined,
      body: {
        messageType: "EMAIL",
        headerToAddress: "user@example.com"
      }
    });
  });
});
