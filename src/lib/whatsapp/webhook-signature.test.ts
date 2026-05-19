import crypto from "node:crypto";
import { describe, it, expect, afterEach } from "vitest";
import { verifyMetaWebhookSignature } from "./webhook-signature";

const SECRET = "test-app-secret";
const BODY = '{"object":"whatsapp_business_account","entry":[]}';

function sign(body: string, secret: string): string {
  return (
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body).digest("hex")
  );
}

afterEach(() => {
  delete process.env.META_APP_SECRET;
});

describe("verifyMetaWebhookSignature", () => {
  it("accepts a signature produced with the configured secret", () => {
    process.env.META_APP_SECRET = SECRET;
    expect(verifyMetaWebhookSignature(BODY, sign(BODY, SECRET))).toBe(true);
  });

  it("rejects a signature from the wrong secret", () => {
    process.env.META_APP_SECRET = SECRET;
    expect(verifyMetaWebhookSignature(BODY, sign(BODY, "wrong-secret"))).toBe(
      false,
    );
  });

  it("rejects a tampered body", () => {
    process.env.META_APP_SECRET = SECRET;
    const header = sign(BODY, SECRET);
    expect(verifyMetaWebhookSignature(BODY + " ", header)).toBe(false);
  });

  it("fails closed when the app secret is not configured", () => {
    expect(verifyMetaWebhookSignature(BODY, sign(BODY, SECRET))).toBe(false);
  });

  it("rejects a missing or malformed signature header", () => {
    process.env.META_APP_SECRET = SECRET;
    expect(verifyMetaWebhookSignature(BODY, null)).toBe(false);
    expect(verifyMetaWebhookSignature(BODY, "deadbeef")).toBe(false);
  });
});
