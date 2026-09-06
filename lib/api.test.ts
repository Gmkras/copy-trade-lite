import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// `lib/api.ts` imports `server-only`, which throws outside React Server; and
// `@/lib/decibel` pulls the SDK, which Vite cannot resolve. Both are replaced.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/decibel", async () => {
  const errors = await import("./decibel/errors");
  return { TradeError: errors.TradeError };
});

import { TradeError } from "./decibel/errors";
import { apiHandler } from "./api";

const post = (body: unknown) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("apiHandler", () => {
  it("wraps a successful result in the envelope", async () => {
    const handler = apiHandler({ run: async () => ({ hello: "world" }) });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("parses the body with the schema and rejects unknown fields with 422", async () => {
    const handler = apiHandler({
      schema: z.object({ size: z.number() }).strict(),
      run: async ({ body }) => body,
    });
    const bad = await handler(post({ size: 1, builderFee: 5 }));
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ ok: false, code: "INVALID_INPUT", message: "Unexpected field: builderFee." });

    const good = await handler(post({ size: 1 }));
    expect(good.status).toBe(200);
  });

  it("returns 400 on malformed JSON", async () => {
    const handler = apiHandler({ schema: z.object({}), run: async () => null });
    const res = await handler(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_JSON");
  });

  it("maps TradeError to 422 with its code and message", async () => {
    const handler = apiHandler({
      run: async () => {
        throw new TradeError("INVALID_SIZE", "Choose an amount between 0.00002 and 0.01 BTC.");
      },
    });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      ok: false,
      code: "INVALID_SIZE",
      message: "Choose an amount between 0.00002 and 0.01 BTC.",
    });
  });

  it("hides unknown errors behind a safe 502 and logs the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = apiHandler({
      run: async () => {
        throw new Error("FetchError https://api.testnet.aptoslabs.com/secret?key=abc at Object.<anonymous> (file.ts:1:1)");
      },
    });
    const res = await handler(new Request("http://localhost/api/test"));
    const json = (await res.json()) as { ok: boolean; code: string; message: string };
    expect(res.status).toBe(502);
    expect(json).toEqual({ ok: false, code: "UPSTREAM", message: "Could not reach the exchange. Try again in a moment." });
    expect(JSON.stringify(json)).not.toMatch(/aptoslabs|key=|at Object/);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("resolves async route params", async () => {
    const handler = apiHandler({ run: async ({ params }) => params.market });
    const res = await handler(new Request("http://localhost/api/price/BTC"), {
      params: Promise.resolve({ market: "BTC/USD" }),
    });
    expect(await res.json()).toEqual({ ok: true, data: "BTC/USD" });
  });
});
