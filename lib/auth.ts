import { timingSafeEqual } from "node:crypto";

import { loadEnv } from "./env.schema";

/**
 * Demo gate for the routes that can sign a transaction.
 *
 * This is deliberately not authentication: there are no accounts and one shared
 * server key signs everything. It exists so that a public deployment does not
 * hand the exchange to anyone who finds the URL, while reading stays open. When
 * `DEMO_PASSCODE` is empty — the default, and what a local clone gets — every
 * route behaves exactly as it did before.
 */

export const PASSCODE_HEADER = "x-demo-passcode";

/** Thrown when a write route is called without the demo code → 401. */
export class UnauthorizedError extends Error {
  readonly code = "DEMO_CODE_REQUIRED";

  constructor(message = "This demo needs a code before it can trade. Enter the code that came with the link.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Constant-time string compare. Different lengths are still compared to a fixed buffer. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    // Compare against itself so the work done does not depend on the guess.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Throws `UnauthorizedError` unless the request carries the configured demo
 * code. Call it as the first statement of any route that can place an order or
 * write a signal, before the body is parsed.
 *
 * `expected` is injectable for tests; in the app it comes from the validated
 * environment. The expected value is never included in the error.
 */
export function assertDemoAccess(request: Request, expected: string = loadEnv().DEMO_PASSCODE): void {
  if (expected === "") return;
  const provided = request.headers.get(PASSCODE_HEADER);
  if (provided === null || !equals(provided, expected)) {
    throw new UnauthorizedError();
  }
}
