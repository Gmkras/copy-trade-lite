import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchEnvelope, initialPollState, pollTransition } from "./usePoll";

describe("pollTransition", () => {
  it("stores data on success and clears stale/error", () => {
    const s1 = pollTransition(initialPollState<number>(), { type: "success", data: 1, at: 10 });
    expect(s1).toEqual({ data: 1, error: null, stale: false, loading: false, updatedAt: 10 });
  });

  it("keeps the last good data and marks it stale on failure, then recovers", () => {
    const ok = pollTransition(initialPollState<number>(), { type: "success", data: 1, at: 10 });
    const failed = pollTransition(ok, { type: "failure", message: "Could not reach the exchange." });
    expect(failed.data).toBe(1);
    expect(failed.stale).toBe(true);
    expect(failed.error).toBe("Could not reach the exchange.");
    const recovered = pollTransition(failed, { type: "success", data: 2, at: 20 });
    expect(recovered).toEqual({ data: 2, error: null, stale: false, loading: false, updatedAt: 20 });
  });

  it("is not stale when there was never any data", () => {
    const failed = pollTransition(initialPollState<number>(), { type: "failure", message: "boom" });
    expect(failed.stale).toBe(false);
    expect(failed.loading).toBe(false);
  });
});

describe("fetchEnvelope", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unwraps ok envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { mid: 5 } }))));
    expect(await fetchEnvelope<{ mid: number }>("/api/price/BTC")).toEqual({ mid: 5 });
  });

  it("turns ok:false into an Error carrying the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, code: "UPSTREAM", message: "Could not reach the exchange." }), { status: 502 })),
    );
    await expect(fetchEnvelope("/api/account")).rejects.toThrow("Could not reach the exchange.");
  });

  it("handles non-JSON bodies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 500 })));
    await expect(fetchEnvelope("/api/account")).rejects.toThrow(/Unexpected response \(500\)/);
  });
});
