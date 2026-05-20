import type { FlowMailerConfig } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ParameterValue = string | number | boolean | null | undefined | Array<string | number | boolean>;

export interface FlowMailerRequest {
  method: HttpMethod;
  path: string;
  accountId?: string;
  matrix?: Record<string, ParameterValue>;
  query?: Record<string, ParameterValue>;
  body?: unknown;
  range?: string;
}

export interface FlowMailerResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T | undefined;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class ReadOnlyViolationError extends Error {
  constructor(method: string, path: string) {
    super(`READ_ONLY is enabled; refusing ${method.toUpperCase()} ${path}`);
    this.name = "ReadOnlyViolationError";
  }
}

export class FlowMailerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly headers: Record<string, string>
  ) {
    super(`FlowMailer API request failed with status ${status}`);
    this.name = "FlowMailerApiError";
  }
}

export class FlowMailerClient {
  private token: TokenState | undefined;

  constructor(
    private readonly config: FlowMailerConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async request<T = unknown>(request: FlowMailerRequest): Promise<FlowMailerResponse<T>> {
    this.assertReadOnlyAllows(request.method, request.path);
    const url = this.buildApiUrl(request);
    return this.requestWithToken<T>(url, request, true);
  }

  private async requestWithToken<T>(
    url: string,
    request: FlowMailerRequest,
    allowTokenRefreshRetry: boolean
  ): Promise<FlowMailerResponse<T>> {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(url, {
      method: request.method,
      headers: this.buildApiHeaders(token, request),
      body: request.body === undefined ? undefined : JSON.stringify(request.body)
    });

    if (response.status === 401 && allowTokenRefreshRetry) {
      this.token = undefined;
      return this.requestWithToken<T>(url, request, false);
    }

    return this.parseResponse<T>(response);
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now) {
      return this.token.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "client_credentials",
      scope: "api"
    });
    const response = await this.fetchImpl(`${this.config.authBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        accept: this.config.apiMediaType,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });
    const parsed = (await readResponseBody(response)) as OAuthTokenResponse;

    if (!response.ok || !parsed?.access_token) {
      throw new FlowMailerApiError(response.status, parsed, selectedHeaders(response.headers));
    }

    const expiresInSeconds = typeof parsed.expires_in === "number" ? parsed.expires_in : 60;
    this.token = {
      accessToken: parsed.access_token,
      expiresAt: now + Math.max(1, expiresInSeconds - 5) * 1000
    };
    return this.token.accessToken;
  }

  private buildApiUrl(request: FlowMailerRequest): string {
    const resolvedPath = this.resolvePath(request.path, request.accountId);
    const matrixPath = appendMatrixParams(resolvedPath, request.matrix);
    const url = new URL(matrixPath, `${this.config.apiBaseUrl}/`);
    appendSearchParams(url, request.query);
    return url.toString();
  }

  private resolvePath(path: string, accountId: string | undefined): string {
    if (!path.startsWith("/")) {
      throw new Error("FlowMailer API path must be a relative path starting with /");
    }
    if (path.startsWith("//")) {
      throw new Error("FlowMailer API path must not be protocol-relative");
    }

    return path.replaceAll("{account_id}", encodeURIComponent(accountId ?? this.config.accountId));
  }

  private buildApiHeaders(token: string, request: FlowMailerRequest): Record<string, string> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: this.config.apiMediaType
    };

    if (request.range) {
      headers.range = request.range;
    }
    if (request.body !== undefined) {
      headers["content-type"] = this.config.apiMediaType;
    }

    return headers;
  }

  private async parseResponse<T>(response: Response): Promise<FlowMailerResponse<T>> {
    const headers = selectedHeaders(response.headers);
    const data = await readResponseBody(response);

    if (!response.ok) {
      throw new FlowMailerApiError(response.status, data, headers);
    }

    return {
      status: response.status,
      headers,
      data: data as T | undefined
    };
  }

  private assertReadOnlyAllows(method: HttpMethod, path: string): void {
    if (this.config.readOnly && method !== "GET") {
      throw new ReadOnlyViolationError(method, path);
    }
  }
}

function appendMatrixParams(path: string, matrix: Record<string, ParameterValue> | undefined): string {
  if (!matrix) {
    return path;
  }

  const entries = Object.entries(matrix).flatMap(([key, value]) => {
    const serialized = serializeParameterValue(value);
    return serialized === undefined ? [] : [[key, serialized] as const];
  });

  if (entries.length === 0) {
    return path;
  }

  const encoded = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join(";");
  return `${path};${encoded}`;
}

function appendSearchParams(url: URL, query: Record<string, ParameterValue> | undefined): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    const serialized = serializeParameterValue(value);
    if (serialized !== undefined) {
      url.searchParams.set(key, serialized);
    }
  }
}

function serializeParameterValue(value: ParameterValue): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : value.map(String).join(",");
  }
  return String(value);
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || /^[\[{]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function selectedHeaders(headers: Headers): Record<string, string> {
  const keep = [
    "content-range",
    "content-type",
    "location",
    "next-range",
    "retry-after",
    "www-authenticate"
  ];
  return Object.fromEntries(
    keep.flatMap((name) => {
      const value = headers.get(name);
      return value === null ? [] : [[name, value]];
    })
  );
}
