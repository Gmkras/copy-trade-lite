import { afterEach, describe, expect, it, vi } from "vitest";

// The SDK ships ESM with extensionless relative imports that Vite cannot
// resolve, and stream.ts only needs `getDecibel` from the client (never called
// here, because every test injects its own sources).
vi.mock("@decibeltrade/sdk", () => ({
  TESTNET_CONFIG: {},
  DecibelReadDex: class {},
  DecibelWriteDex: class {},
  TimeInForce: {},
}));

import { ACCOUNT_COALESCE_MS, liveListenerCount, subscribeLive, type LiveEvent, type StreamSources } from "./stream";

/** A fake exchange: the test drives it by hand. */
function fakeSources() {
  let priceCb: ((p: { market: string; mid: number; mark: number }) => void) | null = null;
  let accountCb: (() => void) | null = null;
  const unsubscribed: string[] = [];
  let opens = 0;

  const sources: StreamSources = {
    subscribePrices: (onData) => {
      opens += 1;
      priceCb = onData;
      return () => unsubscribed.push("prices");
    },
    subscribeAccount: (onChange) => {
      accountCb = onChange;
      return [
        () => unsubscribed.push("positions"),
        () => unsubscribed.push("overview"),
        () => unsubscribed.push("orders"),
        () => unsubscribed.push("fills"),
      ];
    },
  };

  return {
    sources,
    unsubscribed,
    get opens() {
      return opens;
    },
    price: (market: string, mid: number, mark = mid) => priceCb?.({ market, mid, mark }),
    accountChanged: () => accountCb?.(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("subscribeLive", () => {
  it("opens the exchange subscriptions once and shares them", () => {
    const fake = fakeSources();
    const a: LiveEvent[] = [];
    const b: LiveEvent[] = [];
    const stopA = subscribeLive((e) => a.push(e), fake.sources);
    const stopB = subscribeLive((e) => b.push(e), fake.sources);

    expect(fake.opens).toBe(1);
    expect(liveListenerCount()).toBe(2);

    fake.price("BTC/USD", 80_000, 80_010);
    expect(a).toEqual([{ type: "price", market: "BTC/USD", mid: 80_000, mark: 80_010 }]);
    expect(b).toEqual(a);

    stopA();
    stopB();
  });

  it("releases every subscription when the last listener leaves, not before", () => {
    const fake = fakeSources();
    const stopA = subscribeLive(() => {}, fake.sources);
    const stopB = subscribeLive(() => {}, fake.sources);

    stopA();
    expect(fake.unsubscribed).toEqual([]);
    expect(liveListenerCount()).toBe(1);

    stopB();
    expect(fake.unsubscribed).toEqual(["prices", "positions", "overview", "orders", "fills"]);
    expect(liveListenerCount()).toBe(0);
  });

  it("ignores a second stop from the same listener", () => {
    const fake = fakeSources();
    const stopA = subscribeLive(() => {}, fake.sources);
    const stopB = subscribeLive(() => {}, fake.sources);

    stopA();
    stopA(); // must not close the hub while B is still listening
    expect(fake.unsubscribed).toEqual([]);
    expect(liveListenerCount()).toBe(1);
    stopB();
  });

  it("coalesces several account messages into one event", () => {
    vi.useFakeTimers();
    const fake = fakeSources();
    const events: LiveEvent[] = [];
    const stop = subscribeLive((e) => events.push(e), fake.sources);

    fake.accountChanged();
    fake.accountChanged();
    fake.accountChanged();
    expect(events).toEqual([]); // nothing yet: still inside the window

    vi.advanceTimersByTime(ACCOUNT_COALESCE_MS);
    expect(events).toEqual([{ type: "account" }]);

    fake.accountChanged();
    vi.advanceTimersByTime(ACCOUNT_COALESCE_MS);
    expect(events).toHaveLength(2); // a later change is its own event

    stop();
  });

  it("drops a quote it would not show", () => {
    const fake = fakeSources();
    const events: LiveEvent[] = [];
    const stop = subscribeLive((e) => events.push(e), fake.sources);

    fake.price("BTC/USD", 0);
    fake.price("BTC/USD", Number.NaN);
    fake.price("BTC/USD", -1);
    expect(events).toEqual([]);

    fake.price("BTC/USD", 80_000);
    expect(events).toHaveLength(1);
    stop();
  });

  it("keeps delivering when one listener throws", () => {
    const fake = fakeSources();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const good: LiveEvent[] = [];
    const stopBad = subscribeLive(() => {
      throw new Error("listener blew up");
    }, fake.sources);
    const stopGood = subscribeLive((e) => good.push(e), fake.sources);

    fake.price("BTC/USD", 80_000);
    expect(good).toHaveLength(1);
    expect(errors).toHaveBeenCalled();

    errors.mockRestore();
    stopBad();
    stopGood();
  });

  it("reopens after everyone left", () => {
    const fake = fakeSources();
    subscribeLive(() => {}, fake.sources)();
    expect(fake.opens).toBe(1);
    const stop = subscribeLive(() => {}, fake.sources);
    expect(fake.opens).toBe(2);
    stop();
  });
});
