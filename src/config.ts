export interface FlowMailerConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  readOnly: boolean;
  apiBaseUrl: string;
  authBaseUrl: string;
  apiMediaType: string;
}

export type Env = Record<string, string | undefined>;

const ENV_ALIASES = {
  accountId: ["SENDPRO_ACCOUNT_ID", "SPOTLER_SENDPRO_ACCOUNT_ID", "FLOWMAILER_ACCOUNT_ID"],
  clientId: ["SENDPRO_CLIENT_ID", "SPOTLER_SENDPRO_CLIENT_ID", "FLOWMAILER_CLIENT_ID"],
  clientSecret: ["SENDPRO_CLIENT_SECRET", "SPOTLER_SENDPRO_CLIENT_SECRET", "FLOWMAILER_CLIENT_SECRET"],
  readOnly: ["READ_ONLY", "SENDPRO_READ_ONLY", "SPOTLER_SENDPRO_READ_ONLY", "FLOWMAILER_READ_ONLY"],
  apiBaseUrl: ["SENDPRO_API_BASE_URL", "SPOTLER_SENDPRO_API_BASE_URL", "FLOWMAILER_API_BASE_URL"],
  authBaseUrl: ["SENDPRO_AUTH_BASE_URL", "SPOTLER_SENDPRO_AUTH_BASE_URL", "FLOWMAILER_AUTH_BASE_URL"],
  apiMediaType: ["SENDPRO_API_MEDIA_TYPE", "SPOTLER_SENDPRO_API_MEDIA_TYPE", "FLOWMAILER_API_MEDIA_TYPE"]
} as const;

export function loadConfig(env: Env = process.env): FlowMailerConfig {
  const accountId = readFirst(env, ENV_ALIASES.accountId);
  const clientId = readFirst(env, ENV_ALIASES.clientId);
  const clientSecret = readFirst(env, ENV_ALIASES.clientSecret);
  const missing = [
    ["account id", ENV_ALIASES.accountId, accountId],
    ["client id", ENV_ALIASES.clientId, clientId],
    ["client secret", ENV_ALIASES.clientSecret, clientSecret]
  ].flatMap(([label, names, value]) => (value ? [] : [`${label}: ${formatAliases(names as readonly string[])}`]));

  if (missing.length > 0) {
    throw new Error(`Missing required SendPro environment variables: ${missing.join("; ")}`);
  }

  return {
    accountId: accountId as string,
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    readOnly: parseReadOnly(readFirst(env, ENV_ALIASES.readOnly) ?? "true"),
    apiBaseUrl: stripTrailingSlash(readFirst(env, ENV_ALIASES.apiBaseUrl) ?? "https://api.flowmailer.net"),
    authBaseUrl: stripTrailingSlash(readFirst(env, ENV_ALIASES.authBaseUrl) ?? "https://login.flowmailer.net"),
    apiMediaType: readFirst(env, ENV_ALIASES.apiMediaType) ?? "application/vnd.flowmailer.v1.12+json"
  };
}

function readFirst(env: Env, names: readonly string[]): string | undefined {
  return names.map((name) => env[name]).find((value): value is string => value !== undefined && value.length > 0);
}

function formatAliases(names: readonly string[]): string {
  const [primary, ...aliases] = names;
  return aliases.length === 0 ? (primary as string) : `${primary} (aliases: ${aliases.join(", ")})`;
}

function parseReadOnly(value: string): boolean {
  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
