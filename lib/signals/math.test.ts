import { describe as suite, expect, it } from "vitest";

import { describe, headline, holdLabel, isExpired, timeLeftLabel, tpSlPrices } from "./math";

suite("tpSlPrices", () => {
  it("puts TP above and SL below the entry for an Up idea", () => {
    expect(tpSlPrices("up", 80_000, 3, 2)).toEqual({ tpPrice: 82_400, slPrice: 78_400 });
  });

  it("mirrors the sides for a Down idea", () => {
    expect(tpSlPrices("down", 80_000, 3, 2)).toEqual({ tpPrice: 77_600, slPrice: 81_600 });
  });
});

suite("isExpired", () => {
  it("is false before and true at/after expiry", () => {
    expect(isExpired({ expiresAt: 1_000 }, 999)).toBe(false);
    expect(isExpired({ expiresAt: 1_000 }, 1_000)).toBe(true);
    expect(isExpired({ expiresAt: 1_000 }, 5_000)).toBe(true);
  });
});

suite("labels", () => {
  it("holdLabel speaks in hours, days and minutes", () => {
    expect(holdLabel(4)).toBe("4 hours");
    expect(holdLabel(1)).toBe("1 hour");
    expect(holdLabel(48)).toBe("2 days");
    expect(holdLabel(0.5)).toBe("30 minutes");
  });

  it("timeLeftLabel counts down and says expired", () => {
    expect(timeLeftLabel({ expiresAt: 3 * 3_600_000 }, 0)).toBe("3h left");
    expect(timeLeftLabel({ expiresAt: 20 * 60_000 }, 0)).toBe("20m left");
    expect(timeLeftLabel({ expiresAt: 0 }, 1)).toBe("expired");
  });

  it("headline and describe use plain words", () => {
    expect(headline({ market: "BTC/USD", side: "up" })).toBe("went Up on BTC");
    expect(
      describe({ author: "Ana", market: "BTC/USD", side: "up", entryPrice: 80_000, tpPrice: 82_400, slPrice: 78_400, holdHours: 4, size: 0.00002 }),
    ).toBe("Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours.");
  });
});
