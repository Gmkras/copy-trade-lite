"use client";

import { useState } from "react";

import { FRAME_BYTES, OVERFLOW_ERRORS, STACK_BYTES, frames } from "@/lib/learn/simulate";

type Shape = "recursive" | "iterative" | "copyLoop";

const MAX_DEPTH = 40_000;

const RUNTIMES = [
  { id: "node", label: "Node / browser", bytes: STACK_BYTES.node, note: "~1 MB, V8's main thread" },
  { id: "rustMain", label: "Rust, main thread", bytes: STACK_BYTES.rustMain, note: "8 MiB" },
  { id: "rustSpawned", label: "Rust, spawned thread", bytes: STACK_BYTES.rustSpawned, note: "2 MiB by default" },
] as const;

/**
 * How deep you can go before the stack runs out.
 *
 * It never actually recurses: `frames()` answers from arithmetic. A real
 * overflow in the page would take the page down with it, and inside a React
 * tree a reload is usually the only way back (design D3). What *is* real is
 * the error text — recognising it is the useful part.
 */
export function DepthSlider() {
  const [depth, setDepth] = useState(5_000);
  const [shape, setShape] = useState<Shape>("recursive");
  const [runtime, setRuntime] = useState<(typeof RUNTIMES)[number]["id"]>("node");

  const stack = RUNTIMES.find((r) => r.id === runtime) ?? RUNTIMES[0];
  // An iterative version pushes one frame no matter the depth. That is the
  // entire point of the switch.
  const effectiveDepth = shape === "iterative" ? 1 : depth;
  const use = frames(effectiveDepth, FRAME_BYTES, stack.bytes);

  return (
    <section aria-label="How deep before the stack runs out" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Shape" className="flex gap-1">
          {(
            [
              ["recursive", "Recursive"],
              ["iterative", "Iterative"],
              ["copyLoop", "Copy loop"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={shape === id}
              onClick={() => setShape(id)}
              className={[
                "min-h-11 rounded-full border px-3 font-display text-sm font-medium transition-colors",
                shape === id ? "border-text bg-text text-bg" : "border-line text-muted hover:text-text",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Stack
          <select
            value={runtime}
            onChange={(e) => setRuntime(e.target.value as typeof runtime)}
            className="min-h-11 rounded-full border border-line bg-surface px-3 font-display text-sm text-text"
          >
            {RUNTIMES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Recursion depth</span>
          <span className="font-display tabular-nums text-text">
            {shape === "iterative" ? "1 frame, whatever the input" : depth.toLocaleString("en-US")}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={MAX_DEPTH}
          step={100}
          value={depth}
          disabled={shape === "iterative"}
          onChange={(e) => setDepth(Number(e.target.value))}
          aria-label="Recursion depth"
          className="h-11 w-full accent-[#f5f5f4] disabled:opacity-40"
        />
      </label>

      {/* The stack filling up. Clamped, so it can never run off its track. */}
      <div className="flex flex-col gap-1">
        <div className="h-3 w-full overflow-hidden rounded-full border border-line bg-bg">
          <div
            className={["h-full transition-[width] motion-reduce:transition-none", use.fits ? "bg-up" : "bg-down"].join(" ")}
            style={{ width: `${Math.round(use.share * 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted">
          {(use.used / 1024).toFixed(0)} KB of {(stack.bytes / 1024).toFixed(0)} KB ({stack.note}) ·{" "}
          holds about <span className="text-text">{use.capacity.toLocaleString("en-US")}</span> frames at {FRAME_BYTES} bytes each
        </p>
      </div>

      <div aria-live="polite">
        {use.fits ? (
          <p className="rounded-card border border-up/40 bg-surface px-3 py-2 text-sm">
            <span className="text-up">Fits.</span>{" "}
            {shape === "iterative"
              ? "A loop keeps one frame on the stack however long the input is. This is the fix."
              : shape === "copyLoop"
                ? "No cycle yet — but nothing here stops one."
                : "Raise the depth until it does not."}
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-card border border-down/40 bg-surface px-3 py-2">
            <p className="text-sm text-down">
              {shape === "copyLoop"
                ? "The copy produced a copyable idea, which was copied, which produced another. A real copy-trade platform must refuse the cycle — this one settles ideas with a loop, not recursion."
                : "Stack overflow."}
            </p>
            <pre className="overflow-x-auto rounded bg-bg px-2 py-1.5 font-mono text-xs text-muted">
              <code>
                TypeScript · {OVERFLOW_ERRORS.typescript}
                {"\n"}
                Rust · {OVERFLOW_ERRORS.rust}
              </code>
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
