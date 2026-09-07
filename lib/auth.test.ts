import { describe, expect, it } from "vitest";

import { assertDemoAccess, PASSCODE_HEADER, UnauthorizedError } from "./auth";

const SECRET = "orange-lemon-42";

const request = (passcode?: string) =>
  new Request("http://localhost/api/order", {
    method: "POST",
    headers: passcode === undefined ? {} : { [PASSCODE_HEADER]: passcode },
  });

describe("assertDemoAccess", () => {
  it("does nothing when no passcode is configured, with or without a header", () => {
    expect(() => assertDemoAccess(request(), "")).not.toThrow();
    expect(() => assertDemoAccess(request("anything"), "")).not.toThrow();
  });

  it("passes with the correct header", () => {
    expect(() => assertDemoAccess(request(SECRET), SECRET)).not.toThrow();
  });

  it("throws when the header is missing", () => {
    expect(() => assertDemoAccess(request(), SECRET)).toThrow(UnauthorizedError);
  });

  it("throws on a wrong value, including a prefix and a longer guess", () => {
    expect(() => assertDemoAccess(request("wrong"), SECRET)).toThrow(UnauthorizedError);
    expect(() => assertDemoAccess(request("orange-lemon-4"), SECRET)).toThrow(UnauthorizedError);
    expect(() => assertDemoAccess(request(`${SECRET}x`), SECRET)).toThrow(UnauthorizedError);
    expect(() => assertDemoAccess(request(""), SECRET)).toThrow(UnauthorizedError);
  });

  it("never puts the expected value in the error", () => {
    try {
      assertDemoAccess(request("wrong"), SECRET);
      expect.unreachable("should have thrown");
    } catch (error) {
      const thrown = error as UnauthorizedError;
      expect(thrown.code).toBe("DEMO_CODE_REQUIRED");
      expect(`${thrown.message} ${thrown.stack ?? ""}`).not.toContain(SECRET);
    }
  });
});
