"use client";

import { useState } from "react";

import { FREED_BY, MEMORY_STEPS } from "@/lib/learn/content";

/**
 * One real order, frame by frame.
 *
 * The whole sequence is data in `lib/learn/content.ts`; this only moves an
 * index over it, which is what makes stepping backwards exact rather than an
 * undo (design D2).
 */
export function MemoryVisualizer() {
  const [i, setI] = useState(0);
  const step = MEMORY_STEPS[i];
  if (!step) return null;

  const atStart = i === 0;
  const atEnd = i === MEMORY_STEPS.length - 1;

  return (
    <section aria-label="Stack and heap, step by step" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* The stack: grows downward, and only the top ever changes. */}
        <div className="rounded-card border border-line bg-surface p-3">
          <h4 className="font-display text-sm font-medium text-muted">
            Stack <span className="text-text">{step.stack.length} frame{step.stack.length === 1 ? "" : "s"}</span>
          </h4>
          <ol className="mt-2 flex flex-col gap-1.5">
            {step.stack.length === 0 ? (
              <li className="rounded border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                empty
              </li>
            ) : (
              step.stack.map((frame, depth) => (
                <li
                  key={frame.fn}
                  className={[
                    "rounded border px-3 py-2",
                    depth === step.stack.length - 1 ? "border-text bg-bg" : "border-line bg-bg",
                  ].join(" ")}
                >
                  <p className="font-mono text-sm text-text">{frame.fn}()</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">{frame.locals}</p>
                </li>
              ))
            )}
          </ol>
          <p className="mt-2 text-xs text-muted">Fixed size. Freed by returning — nobody decides when.</p>
        </div>

        {/* The heap: outlives the frame that created it. */}
        <div className="rounded-card border border-line bg-surface p-3">
          <h4 className="font-display text-sm font-medium text-muted">Heap</h4>
          <div className="mt-2 flex flex-col gap-1.5">
            {step.heap.length === 0 ? (
              <p className="rounded border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                empty
              </p>
            ) : (
              step.heap.map((object) => (
                <div
                  key={object.label}
                  className={[
                    "rounded border px-3 py-2",
                    object.reachable ? "border-line bg-bg" : "border-down/40 bg-bg",
                  ].join(" ")}
                >
                  <p className="font-mono text-sm text-text">{object.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{object.detail}</p>
                  {!object.reachable ? (
                    <p className="mt-1 text-xs text-down">unreachable — nothing points at it</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <dl className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
            <div className="flex gap-1.5">
              <dt className="font-mono">TS</dt>
              <dd>{FREED_BY.typescript}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-mono">Rust</dt>
              <dd>{FREED_BY.rust}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p aria-live="polite" className="min-h-[3rem] text-sm text-text">
        {step.caption}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={atStart}
          className="min-h-11 rounded-full border border-line px-4 font-display text-sm font-medium text-text disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setI((n) => Math.min(MEMORY_STEPS.length - 1, n + 1))}
          disabled={atEnd}
          className="min-h-11 rounded-full border border-text bg-text px-4 font-display text-sm font-medium text-bg disabled:opacity-40"
        >
          Step →
        </button>
        <span className="text-sm text-muted">
          {i + 1} / {MEMORY_STEPS.length}
        </span>
        {atEnd ? (
          <button
            type="button"
            onClick={() => setI(0)}
            className="ml-auto min-h-11 rounded-full border border-line px-4 font-display text-sm font-medium text-muted"
          >
            Start over
          </button>
        ) : null}
      </div>
    </section>
  );
}
