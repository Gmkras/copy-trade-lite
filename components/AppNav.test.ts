import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The navigation carries exactly two tabs, and `/learn` is not one of them.
 *
 * `/learn` is deliberately reachable only by its address: it is not part of
 * the product. "We decided not to link it" is the kind of decision that decays
 * the first time someone adds a footer, so it is asserted rather than
 * remembered (design D7 of `learn-fundamentals`).
 *
 * The component is read as text rather than rendered: these tests run in a
 * Node environment with no DOM, and what matters here is the declaration.
 */
const source = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");

describe("AppNav", () => {
  it("declares exactly two tabs", () => {
    const hrefs = [...source.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/", "/trade"]);
  });

  it("does not link to /learn", () => {
    expect(source).not.toContain("/learn");
  });
});
