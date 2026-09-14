/**
 * The words and the step sequence the /learn page renders. Data, not markup,
 * so the sequence can be checked by a test and read without a browser.
 *
 * The call path below is the real one: `placeMarketOrder` in
 * `lib/decibel/orders.ts` calls `toValidOrderSize` in `lib/decibel/units.ts`,
 * which calls `toChainUnits` and then `floorToLot`. The frames on screen are
 * frames this app actually pushes to send an order (design D2).
 */

export type StackFrame = {
  /** The function, as it is named in this repository. */
  fn: string;
  /** Its locals at this moment, short enough to read at a glance. */
  locals: string;
};

export type HeapObject = {
  label: string;
  detail: string;
  /** False once nothing on the stack points at it any more. */
  reachable: boolean;
};

export type MemoryStep = {
  stack: StackFrame[];
  heap: HeapObject[];
  /** One line on what just happened. */
  caption: string;
};

const MARKETS: HeapObject = {
  label: "markets: Market[]",
  detail: "36 objects — the size is only known at run time",
  reachable: true,
};

/**
 * One real order, frame by frame. Stepping forward pushes; stepping back
 * restores the previous state exactly, because each state is stored rather
 * than recomputed.
 */
export const MEMORY_STEPS: MemoryStep[] = [
  {
    stack: [],
    heap: [],
    caption: "Nothing is running. The stack is empty and so is the heap.",
  },
  {
    stack: [{ fn: "placeMarketOrder", locals: "input, deps" }],
    heap: [],
    caption: "You tap the yellow button. One frame is pushed, holding its arguments.",
  },
  {
    stack: [{ fn: "placeMarketOrder", locals: "input, deps, markets → heap" }],
    heap: [MARKETS],
    caption:
      "await deps.getMarkets() — 36 markets. Nobody knew the count at compile time, so the array goes on the heap and the frame keeps only a reference to it.",
  },
  {
    stack: [
      { fn: "placeMarketOrder", locals: "input, deps, markets → heap" },
      { fn: "toValidOrderSize", locals: "sizeHuman 0.00002, market, maxOrderSize 0.01" },
    ],
    heap: [MARKETS],
    caption: "A second frame, on top of the first. The stack only ever grows and shrinks at the top.",
  },
  {
    stack: [
      { fn: "placeMarketOrder", locals: "input, deps, markets → heap" },
      { fn: "toValidOrderSize", locals: "sizeHuman 0.00002, market, maxOrderSize 0.01" },
      { fn: "toChainUnits", locals: "value 0.00002, decimals 9, mode 'floor'" },
    ],
    heap: [MARKETS],
    caption: "Three deep. Each frame is a fixed size, known before the program ran.",
  },
  {
    stack: [
      { fn: "placeMarketOrder", locals: "input, deps, markets → heap" },
      { fn: "toValidOrderSize", locals: "sizeHuman 0.00002, …, scaled 20000" },
    ],
    heap: [MARKETS],
    caption: "toChainUnits returns 20000. Its frame is gone — no cleanup, the stack pointer just moved back.",
  },
  {
    stack: [
      { fn: "placeMarketOrder", locals: "input, deps, markets → heap" },
      { fn: "toValidOrderSize", locals: "sizeHuman 0.00002, …, scaled 20000" },
      { fn: "floorToLot", locals: "sizeUnits 20000, lotSize 10000" },
    ],
    heap: [MARKETS],
    caption: "floorToLot takes the same slot toChainUnits just left. The stack reuses its space immediately.",
  },
  {
    stack: [
      { fn: "placeMarketOrder", locals: "input, deps, markets → heap" },
      { fn: "toValidOrderSize", locals: "units 20000" },
    ],
    heap: [MARKETS],
    caption: "floorToLot returns 20000 — the size, floored to the lot, in chain units.",
  },
  {
    stack: [{ fn: "placeMarketOrder", locals: "input, deps, markets → heap, sizeUnits 20000" }],
    heap: [MARKETS],
    caption: "toValidOrderSize returns. Every number it computed lived and died in its own frame.",
  },
  {
    stack: [],
    heap: [{ ...MARKETS, reachable: false }],
    caption:
      "The order is sent and the last frame pops. The array is still in memory, but nothing points at it any more — and that is the whole difference between the two.",
  },
];

/** What frees the heap object, in each language. The page shows both. */
export const FREED_BY = {
  typescript: "V8's garbage collector, whenever it next runs",
  rust: "the moment its owner goes out of scope — no collector, no waiting",
} as const;

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  /** Index into `options`. */
  correct: number;
  /** Shown either way, so a wrong answer still teaches. */
  explanation: string;
};

export const QUIZ: QuizQuestion[] = [
  {
    id: "where-array",
    question: "An order handler reads 36 markets into an array. Where does the array live?",
    options: [
      "On the stack, with the frame that created it",
      "On the heap, with a reference to it on the stack",
      "On the stack in TypeScript, on the heap in Rust",
      "Wherever the compiler finds room",
    ],
    correct: 1,
    explanation:
      "Its size is only known at run time, so the data goes on the heap and the frame holds a pointer. That is true in both languages — what differs is who frees it.",
  },
  {
    id: "who-frees",
    question: "What frees that array in Rust?",
    options: [
      "A garbage collector, on its own schedule",
      "An explicit free() the programmer must remember",
      "Its owner going out of scope",
      "Nothing — it leaks until the process exits",
    ],
    correct: 2,
    explanation:
      "Rust frees it when the owner goes out of scope, so the moment is deterministic. TypeScript waits for a collector, so the moment is not.",
  },
  {
    id: "overflow-cause",
    question: "Which of these overflows the stack?",
    options: [
      "Allocating a very large array",
      "Recursion whose depth depends on the input",
      "Holding many objects alive at once",
      "A loop that runs a million times",
    ],
    correct: 1,
    explanation:
      "The stack is small and fixed; the heap is large and elastic. A big array is a heap problem. Unbounded recursion is the stack one — and the version that depends on the input is the one that passes your tests and fails in production.",
  },
  {
    id: "overflow-fix",
    question: "Your candle scan recurses once per candle and crashes on long ranges. The fix?",
    options: [
      "Rewrite it as a loop",
      "Increase the stack size",
      "Rely on tail-call optimisation",
      "Wrap the recursion in try/catch",
    ],
    correct: 0,
    explanation:
      "V8 never shipped tail-call optimisation and Rust does not guarantee it, so a loop — or an explicit stack on the heap — is the fix. Catching the error leaves the bug in place. This app's settleSignal scans candles with a loop for exactly this reason.",
  },
  {
    id: "which-protocol-price",
    question: "Streaming live prices, a packet is lost. Which behaviour do you want?",
    options: [
      "Stall and retransmit, so no price is missed",
      "Skip it and keep going with the newest",
      "Retry three times, then skip",
      "Close the connection and reconnect",
    ],
    correct: 1,
    explanation:
      "A price from 200 ms ago that finally arrives is worth nothing, and waiting for it holds up every fresher price behind it — head-of-line blocking. That is why market-data feeds use UDP, and why useLive in this app keeps only the newest mid and drops the rest.",
  },
  {
    id: "which-protocol-order",
    question: "Why does this app send orders over TCP rather than UDP?",
    options: [
      "TCP is faster over long distances",
      "UDP cannot carry JSON",
      "An order must arrive exactly once, in order",
      "Browsers cannot open a TCP socket",
    ],
    correct: 2,
    explanation:
      "An order that arrives twice, or out of order, is a financial bug. It is also the other way round from the browser's point of view: a browser cannot speak UDP at all — only HTTP, WebSocket and WebRTC — which is one reason this app streams prices as server-sent events.",
  },
];
