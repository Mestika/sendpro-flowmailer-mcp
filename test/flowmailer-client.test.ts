import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  FlowMailerApiError,
  FlowMailerClient,
  ReadOnlyViolationError
} from "../src/flowmailer-client.js";
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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/vnd.flowmailer.v1.12+json",
      ...(init.headers ?? {})
    }
  });
}

describe("FlowMailerClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test("requests an OAuth token and performs a GET request with account, matrix, query, and range parameters", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 60 }))
      .mockResolvedValueOnce(
        jsonResponse([{ id: "message-1" }], {
          status: 206,
          headers: {
            "content-range": "items 0-10/1",
            "next-range": "items=next:10"
          }
        })
      );
    const client = new FlowMailerClient(config, fetchMock);

    const response = await client.request({
      method: "GET",
      path: "/{account_id}/messages",
      matrix: {
        daterange: "2024-03-01T00:00:00Z,2024-05-01T00:00:00Z",
        flow_ids: ["16801", "16814"]
      },
      query: {
        addheaders: true,
        empty: undefined,
        sortfield: "INSERTED"
      },
      range: "items=:10"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://login.flowmailer.net/oauth/token");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        accept: "application/vnd.flowmailer.v1.12+json",
        "content-type": "application/x-www-form-urlencoded"
      })
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body?.toString()).toBe(
      "client_id=client-id&client_secret=client-secret&grant_type=client_credentials&scope=api"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.flowmailer.net/545/messages;daterange=2024-03-01T00%3A00%3A00Z%2C2024-05-01T00%3A00%3A00Z;flow_ids=16801%2C16814?addheaders=true&sortfield=INSERTED"
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        authorization: "Bearer token-1",
        accept: "application/vnd.flowmailer.v1.12+json",
        range: "items=:10"
      })
    });
    expect(response).toEqual({
      status: 206,
      headers: {
        "content-range": "items 0-10/1",
        "content-type": "application/vnd.flowmailer.v1.12+json",
        "next-range": "items=next:10"
      },
      data: [{ id: "message-1" }]
    });
  });

  test("rejects mutating API requests before fetching a token when read-only mode is enabled", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new FlowMailerClient(config, fetchMock);

    await expect(
      client.request({
        method: "POST",
        path: "/{account_id}/messages/submit",
        body: { messageType: "EMAIL" }
      })
    ).rejects.toBeInstanceOf(ReadOnlyViolationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows mutating API requests when read-only mode is disabled", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 60 }))
      .mockResolvedValueOnce(new Response(null, { status: 201, headers: { location: "https://api.flowmailer.net/545/messages/new-id" } }));
    const client = new FlowMailerClient({ ...config, readOnly: false }, fetchMock);

    const response = await client.request({
      method: "POST",
      path: "/{account_id}/messages/submit",
      body: { messageType: "EMAIL" }
    });

    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ messageType: "EMAIL" }),
      headers: expect.objectContaining({
        "content-type": "application/vnd.flowmailer.v1.12+json"
      })
    });
    expect(response).toEqual({
      status: 201,
      headers: {
        location: "https://api.flowmailer.net/545/messages/new-id"
      },
      data: undefined
    });
  });

  test("refreshes the token once and retries when the API returns 401", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "expired-token", expires_in: 60 }))
      .mockResolvedValueOnce(jsonResponse({ error: "invalid_token" }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh-token", expires_in: 60 }))
      .mockResolvedValueOnce(jsonResponse({ id: "message-1" }));
    const client = new FlowMailerClient(config, fetchMock);

    const response = await client.request({
      method: "GET",
      path: "/{account_id}/messages/message-1"
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]?.[1]?.headers).toMatchObject({
      authorization: "Bearer fresh-token"
    });
    expect(response.data).toEqual({ id: "message-1" });
  });

  test("rejects absolute or protocol-relative API paths", async () => {
    const client = new FlowMailerClient(config, vi.fn<typeof fetch>());

    await expect(
      client.request({ method: "GET", path: "https://evil.example/545/messages" })
    ).rejects.toThrow("FlowMailer API path must be a relative path starting with /");
    await expect(client.request({ method: "GET", path: "//evil.example" })).rejects.toThrow(
      "FlowMailer API path must not be protocol-relative"
    );
  });

  test("throws FlowMailerApiError with parsed error body for non-success responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 60 }))
      .mockResolvedValueOnce(jsonResponse({ errors: [{ code: "BAD" }] }, { status: 400 }));
    const client = new FlowMailerClient(config, fetchMock);

    await expect(client.request({ method: "GET", path: "/{account_id}/messages" })).rejects.toMatchObject({
      status: 400,
      body: { errors: [{ code: "BAD" }] }
    } satisfies Partial<FlowMailerApiError>);
  });
});
