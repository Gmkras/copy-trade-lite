/**
 * The arithmetic behind the /learn page's three interactives. Pure functions,
 * no React, no timers, no randomness the caller cannot reproduce — the same
 * rule the rest of this project follows for anything that computes a number
 * (`units.ts`, `outcome.ts`, `charts.ts`).
 *
 * Nothing here recurses deeply or opens a socket: the page *explains* a stack
 * overflow and a lossy network, it does not stage one. A real overflow would
 * take the page down with it (design D3).
 */

/** Rough size of one call frame in bytes. Enough for a few locals and the return address. */
export const FRAME_BYTES = 88;

/**
 * Default stack sizes, as each runtime ships them. Defaults, not guarantees:
 * they vary by platform and by how a thread was created, which is why the page
 * shows the number it is using instead of asserting a universal truth.
 */
export const STACK_BYTES = {
  /** V8's main thread, ~1 MB. */
  node: 1_000_000,
  /** A Rust main thread, 8 MiB. */
  rustMain: 8 * 1024 * 1024,
  /** A Rust thread from `thread::spawn`, 2 MiB by default. */
  rustSpawned: 2 * 1024 * 1024,
} as const;

export type FrameUse = {
  /** Bytes the frames would occupy. */
  used: number;
  /** Whether they fit in the stack given. */
  fits: boolean;
  /** Share of the stack used, 0..1, clamped at 1 so a bar never overflows its track. */
  share: number;
  /** How many frames the stack holds at this frame size. */
  capacity: number;
};

/**
 * What `depth` nested calls cost, and whether the stack holds them.
 *
 * A depth of zero or less costs nothing and always fits: there is no such
 * thing as a negative call.
 */
export function frames(depth: number, frameBytes = FRAME_BYTES, stackBytes: number = STACK_BYTES.node): FrameUse {
  const capacity = frameBytes > 0 ? Math.floor(stackBytes / frameBytes) : 0;
  if (!Number.isFinite(depth) || depth <= 0) {
    return { used: 0, fits: true, share: 0, capacity };
  }
  const used = depth * frameBytes;
  return {
    used,
    fits: used <= stackBytes,
    share: stackBytes > 0 ? Math.min(1, used / stackBytes) : 1,
    capacity,
  };
}

/** The error each runtime actually prints. Recognising these is the useful part. */
export const OVERFLOW_ERRORS = {
  typescript: "RangeError: Maximum call stack size exceeded",
  rust: "thread 'main' has overflowed its stack",
} as const;

export type Protocol = "tcp" | "udp";

export type Delivery = {
  /** Sequence numbers that reached the other end, in the order they arrived. */
  arrived: number[];
  /** How old the newest delivered update is, in milliseconds. */
  newestAgeMs: number;
  /** How many slots the lane spent waiting on a retransmission. */
  stalls: number;
};

/** One update is sent per slot; this is how long a slot lasts. */
export const SLOT_MS = 120;

/**
 * A tiny seeded generator. `Math.random` would make every run different, which
 * a test cannot assert on and which would stop the two lanes from being
 * compared under the same losses — the whole point of the side-by-side.
 */
function rng(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    // xorshift32: short, deterministic, and good enough to scatter losses.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/**
 * Sends `updates` price updates down one lane and reports what the other end
 * got, and how stale its freshest value is.
 *
 * The two protocols differ in what they do with a lost packet, and that is the
 * whole lesson:
 *
 *  - **TCP** delivers everything, in order. A loss costs the lane a slot while
 *    it retransmits, and everything behind it waits — head-of-line blocking.
 *    You get every price, and the newest one is older than it should be.
 *  - **UDP** delivers what arrives and never waits. A loss is simply gone. You
 *    get fewer prices, and the newest one is as fresh as the wire allows.
 *
 * For an order you want the first. For a price you want the second, because a
 * price from 200 ms ago that finally arrives is worth nothing.
 */
export function deliver(updates: number, lossPercent: number, protocol: Protocol, seed = 1): Delivery {
  const count = Number.isFinite(updates) && updates > 0 ? Math.floor(updates) : 0;
  const loss = Math.min(100, Math.max(0, Number.isFinite(lossPercent) ? lossPercent : 0));
  if (count === 0) return { arrived: [], newestAgeMs: 0, stalls: 0 };

  const next = rng(seed);
  const arrived: number[] = [];
  let stalls = 0;

  for (let i = 0; i < count; i += 1) {
    const lost = next() * 100 < loss;
    if (!lost) {
      arrived.push(i);
    } else if (protocol === "tcp") {
      // Retransmitted: it still gets there, one slot late, and it held up
      // everything behind it while it did.
      arrived.push(i);
      stalls += 1;
    }
    // UDP: a lost update is simply never mentioned again.
  }

  // Slots elapsed includes the ones TCP spent retransmitting.
  const slotsElapsed = count + stalls;
  const lastArrivedIndex = arrived.length > 0 ? (arrived[arrived.length - 1] as number) : null;
  // How many slots ago the freshest delivered update was *sent*.
  const newestAgeMs =
    lastArrivedIndex === null ? 0 : (slotsElapsed - 1 - lastArrivedIndex) * SLOT_MS;

  return { arrived, newestAgeMs, stalls };
}

export type QuizAnswer = { chosen: number; correct: number };

/** Right answers out of the ones actually answered, plus the total asked. */
export function score(answers: QuizAnswer[], total = answers.length): { correct: number; total: number } {
  return { correct: answers.filter((a) => a.chosen === a.correct).length, total };
}
