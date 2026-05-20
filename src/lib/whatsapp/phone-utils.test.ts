import { describe, it, expect } from "vitest";
import {
  sanitizePhoneForMeta,
  normalizePhone,
  phonesMatch,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from "./phone-utils";

describe("sanitizePhoneForMeta", () => {
  it("strips every non-digit character", () => {
    expect(sanitizePhoneForMeta("+370 63949836")).toBe("37063949836");
    expect(sanitizePhoneForMeta("(555) 123-4567")).toBe("5551234567");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizePhoneForMeta("")).toBe("");
  });
});

describe("normalizePhone", () => {
  it("matches sanitize behaviour for comparison use", () => {
    expect(normalizePhone("+1-202-555-0100")).toBe("12025550100");
  });
});

describe("phonesMatch", () => {
  it("treats identical numbers as a match", () => {
    expect(phonesMatch("37063949836", "+370 63949836")).toBe(true);
  });

  it("matches across a trunk-prefix difference via the last 8 digits", () => {
    expect(phonesMatch("370063949836", "37063949836")).toBe(true);
  });

  it("rejects unrelated numbers", () => {
    expect(phonesMatch("37063949836", "12025550100")).toBe(false);
  });
});

describe("isValidE164", () => {
  it("accepts well-formed numbers with or without a plus", () => {
    expect(isValidE164("+37063949836")).toBe(true);
    expect(isValidE164("12025550100")).toBe(true);
  });

  it("rejects numbers that are too short or start with zero", () => {
    expect(isValidE164("012345")).toBe(false);
    expect(isValidE164("123")).toBe(false);
  });
});

describe("phoneVariants", () => {
  it("returns an empty list for empty input", () => {
    expect(phoneVariants("")).toEqual([]);
  });

  it("keeps the original number first and deduplicates", () => {
    const variants = phoneVariants("37063949836");
    expect(variants[0]).toBe("37063949836");
    expect(new Set(variants).size).toBe(variants.length);
  });

  it("offers both trunk-zero insertion and removal variants", () => {
    expect(phoneVariants("37063949836")).toContain("370063949836");
    expect(phoneVariants("370063949836")).toContain("37063949836");
  });
});

describe("isRecipientNotAllowedError", () => {
  it("detects the Meta sandbox allow-list error", () => {
    expect(isRecipientNotAllowedError("error code 131030")).toBe(true);
    expect(isRecipientNotAllowedError("Recipient not in allowed list")).toBe(
      true,
    );
  });

  it("ignores unrelated error messages", () => {
    expect(isRecipientNotAllowedError("rate limit exceeded")).toBe(false);
  });
});
