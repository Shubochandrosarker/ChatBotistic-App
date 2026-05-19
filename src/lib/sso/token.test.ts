import { describe, it, expect } from "vitest";
import { signSsoToken, verifySsoToken, SsoTokenError } from "./token";

const SECRET = "shared-sso-secret";

const baseClaims = {
  sub: "wp-user-42",
  email: "owner@acme.test",
  name: "Acme Owner",
  plan: "growth",
};

describe("SSO token round trip", () => {
  it("verifies a freshly signed token and returns its claims", () => {
    const token = signSsoToken(baseClaims, SECRET);
    const claims = verifySsoToken(token, SECRET);
    expect(claims.sub).toBe("wp-user-42");
    expect(claims.email).toBe("owner@acme.test");
    expect(claims.plan).toBe("growth");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSsoToken(baseClaims, "other-secret");
    expect(() => verifySsoToken(token, SECRET)).toThrow(SsoTokenError);
  });

  it("rejects a tampered payload", () => {
    const token = signSsoToken(baseClaims, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...baseClaims, plan: "agency", iat: 0, exp: 9e9 }),
    ).toString("base64url");
    expect(() => verifySsoToken(`${forged}.${sig}`, SECRET)).toThrow(
      SsoTokenError,
    );
  });

  it("rejects an expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signSsoToken(
      { ...baseClaims, iat: now - 10_000, exp: now - 9_000 },
      SECRET,
    );
    expect(() => verifySsoToken(token, SECRET)).toThrow(/expired/i);
  });

  it("rejects a token issued in the future", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signSsoToken(
      { ...baseClaims, iat: now + 10_000, exp: now + 20_000 },
      SECRET,
    );
    expect(() => verifySsoToken(token, SECRET)).toThrow(/future/i);
  });

  it("rejects a structurally malformed token", () => {
    expect(() => verifySsoToken("not-a-token", SECRET)).toThrow(SsoTokenError);
  });

  it("rejects verification with no configured secret", () => {
    const token = signSsoToken(baseClaims, SECRET);
    expect(() => verifySsoToken(token, "")).toThrow(SsoTokenError);
  });
});
