import { describe, it, expect } from "vitest";
import { getBroadcastStatus, getRecipientStatus } from "./broadcast-status";

describe("getBroadcastStatus", () => {
  it("maps known statuses to their display config", () => {
    expect(getBroadcastStatus("sent").label).toBe("Sent");
    expect(getBroadcastStatus("failed").label).toBe("Failed");
  });

  it("marks the in-flight status as pulsing", () => {
    expect(getBroadcastStatus("sending").pulse).toBe(true);
  });

  it("falls back to draft for an unknown status", () => {
    expect(getBroadcastStatus("bogus").label).toBe("Draft");
  });
});

describe("getRecipientStatus", () => {
  it("maps known recipient statuses", () => {
    expect(getRecipientStatus("delivered").label).toBe("Delivered");
    expect(getRecipientStatus("replied").label).toBe("Replied");
  });

  it("falls back to pending for an unknown status", () => {
    expect(getRecipientStatus("bogus").label).toBe("Pending");
  });
});
