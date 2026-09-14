import { describe, expect, it } from "vitest";

import { deliver, frames, score, FRAME_BYTES, STACK_BYTES } from "./simulate";

describe("frames", () => {
  it("reports what a depth costs and that it fits", () => {
    const { used, fits, share } = frames(1_000, 100, 1_000_000);
    expect(used).toBe(100_000);
    expect(fits).toBe(true);
    expect(share).toBeCloseTo(0.1);
  });

  it("reports an overflow past the stack", () => {
    const { fits, share } = frames(20_000, 100, 1_000_000);
    expect(fits).toBe(false);
    // The share is clamped so a progress bar can never run off its track.
    expect(share).toBe(1);
  });

  it("fits exactly at the boundary, and not one frame past it", () => {
    expect(frames(10_000, 100, 1_000_000).fits).toBe(true);
    expect(frames(10_001, 100, 1_000_000).fits).toBe(false);
  });

  it("treats zero or negative depth as costing nothing", () => {
    expect(frames(0, 100, 1_000_000)).toMatchObject({ used: 0, fits: true, share: 0 });
    expect(frames(-5, 100, 1_000_000)).toMatchObject({ used: 0, fits: true });
  });

  it("says how many frames the stack holds", () => {
    expect(frames(1, 100, 1_000_000).capacity).toBe(10_000);
  });

  it("puts V8's default stack in the thousands of frames, not the millions", () => {
    // The number the page quotes: ~1 MB and a frame of a few dozen bytes.
    const { capacity } = frames(1, FRAME_BYTES, STACK_BYTES.node);
    expect(capacity).toBeGreaterThan(5_000);
    expect(capacity).toBeLessThan(50_000);
  });

  it("gives a Rust main thread far more room than V8", () => {
    expect(frames(1, FRAME_BYTES, STACK_BYTES.rustMain).capacity).toBeGreaterThan(
      frames(1, FRAME_BYTES, STACK_BYTES.node).capacity * 4,
    );
  });
});

describe("deliver", () => {
  it("delivers everything down both lanes when nothing is lost", () => {
    const tcp = deliver(10, 0, "tcp");
    const udp = deliver(10, 0, "udp");
    expect(tcp.arrived).toHaveLength(10);
    expect(udp.arrived).toHaveLength(10);
    expect(tcp.stalls).toBe(0);
    expect(tcp.newestAgeMs).toBe(udp.newestAgeMs);
  });

  it("is the same run twice for the same seed", () => {
    expect(deliver(20, 30, "udp", 7)).toEqual(deliver(20, 30, "udp", 7));
    expect(deliver(20, 30, "tcp", 7)).toEqual(deliver(20, 30, "tcp", 7));
  });

  it("gives different runs for different seeds", () => {
    const a = deliver(20, 30, "udp", 1);
    const b = deliver(20, 30, "udp", 99);
    expect(a.arrived).not.toEqual(b.arrived);
  });

  it("TCP arrives complete but later; UDP arrives incomplete but fresher", () => {
    const tcp = deliver(20, 40, "tcp", 3);
    const udp = deliver(20, 40, "udp", 3);
    // Same seed, so the same updates are lost on the wire.
    expect(tcp.arrived).toHaveLength(20);
    expect(udp.arrived.length).toBeLessThan(20);
    expect(tcp.stalls).toBeGreaterThan(0);
    expect(tcp.newestAgeMs).toBeGreaterThan(udp.newestAgeMs);
  });

  it("UDP never stalls, whatever the loss", () => {
    expect(deliver(20, 80, "udp", 5).stalls).toBe(0);
  });

  it("delivers nothing over UDP when everything is lost, and everything over TCP", () => {
    expect(deliver(10, 100, "udp").arrived).toEqual([]);
    expect(deliver(10, 100, "tcp").arrived).toHaveLength(10);
  });

  it("returns an empty run for no updates", () => {
    expect(deliver(0, 50, "tcp")).toEqual({ arrived: [], newestAgeMs: 0, stalls: 0 });
  });

  it("keeps UDP's arrivals in order and free of duplicates", () => {
    const { arrived } = deliver(30, 35, "udp", 11);
    expect([...arrived].sort((a, b) => a - b)).toEqual(arrived);
    expect(new Set(arrived).size).toBe(arrived.length);
  });
});

describe("score", () => {
  it("counts the right answers", () => {
    expect(score([{ chosen: 1, correct: 1 }, { chosen: 0, correct: 2 }, { chosen: 3, correct: 3 }])).toEqual({
      correct: 2,
      total: 3,
    });
  });

  it("handles all right and all wrong", () => {
    expect(score([{ chosen: 1, correct: 1 }])).toEqual({ correct: 1, total: 1 });
    expect(score([{ chosen: 0, correct: 1 }])).toEqual({ correct: 0, total: 1 });
  });

  it("scores an unstarted quiz as zero out of the questions asked", () => {
    expect(score([], 6)).toEqual({ correct: 0, total: 6 });
  });
});
