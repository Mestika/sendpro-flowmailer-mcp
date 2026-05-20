import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const baseEnv = {
    SENDPRO_ACCOUNT_ID: "545",
    SENDPRO_CLIENT_ID: "client-id",
    SENDPRO_CLIENT_SECRET: "client-secret"
  };

  test("loads required credentials and defaults to read-only mode", () => {
    const config = loadConfig(baseEnv);

    expect(config).toMatchObject({
      accountId: "545",
      clientId: "client-id",
      clientSecret: "client-secret",
      readOnly: true,
      apiBaseUrl: "https://api.flowmailer.net",
      authBaseUrl: "https://login.flowmailer.net",
      apiMediaType: "application/vnd.flowmailer.v1.12+json"
    });
  });

  test("supports READ_ONLY as an override for FlowMailer-specific read-only env", () => {
    const config = loadConfig({
      ...baseEnv,
      SENDPRO_READ_ONLY: "false",
      READ_ONLY: "true"
    });

    expect(config.readOnly).toBe(true);
  });

  test("accepts false-like read-only values", () => {
    const config = loadConfig({
      ...baseEnv,
      SENDPRO_READ_ONLY: "0"
    });

    expect(config.readOnly).toBe(false);
  });

  test("supports legacy FlowMailer credential aliases", () => {
    const config = loadConfig({
      FLOWMAILER_ACCOUNT_ID: "545",
      FLOWMAILER_CLIENT_ID: "client-id",
      FLOWMAILER_CLIENT_SECRET: "client-secret"
    });

    expect(config.accountId).toBe("545");
    expect(config.clientId).toBe("client-id");
    expect(config.clientSecret).toBe("client-secret");
  });

  test("supports Spotler SendPro credential aliases", () => {
    const config = loadConfig({
      SPOTLER_SENDPRO_ACCOUNT_ID: "545",
      SPOTLER_SENDPRO_CLIENT_ID: "client-id",
      SPOTLER_SENDPRO_CLIENT_SECRET: "client-secret"
    });

    expect(config.accountId).toBe("545");
    expect(config.clientId).toBe("client-id");
    expect(config.clientSecret).toBe("client-secret");
  });

  test("reports every missing required credential", () => {
    expect(() => loadConfig({})).toThrow("Missing required SendPro environment variables");
    expect(() => loadConfig({})).toThrow("SENDPRO_ACCOUNT_ID");
    expect(() => loadConfig({})).toThrow("SENDPRO_CLIENT_ID");
    expect(() => loadConfig({})).toThrow("SENDPRO_CLIENT_SECRET");
  });
});
