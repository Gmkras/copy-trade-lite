"use client";

import { useState } from "react";

type CodeCompareProps = {
  typescript: string;
  rust: string;
  /** One line on what the two snippets are showing. */
  caption?: string;
};

/**
 * The same idea in both languages: side by side from `lg:`, one at a time
 * below it.
 *
 * The Rust pane says "for comparison" on purpose. Someone reading this
 * repository should never be left wondering whether the project contains Rust
 * — it does not. This is text the page renders, nothing compiles it (design D5).
 *
 * No syntax highlighter: that would be a dependency for a page that is not
 * part of the product, and these snippets are four lines long.
 */
export function CodeCompare({ typescript, rust, caption }: CodeCompareProps) {
  const [shown, setShown] = useState<"typescript" | "rust">("typescript");

  return (
    <div className="flex flex-col gap-2">
      {/* Phones: one at a time. */}
      <div role="group" aria-label="Language" className="flex gap-1 lg:hidden">
        {(
          [
            ["typescript", "TypeScript"],
            ["rust", "Rust"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={shown === id}
            onClick={() => setShown(id)}
            className={[
              "min-h-11 rounded-full border px-3 font-display text-sm font-medium transition-colors",
              shown === id ? "border-text bg-text text-bg" : "border-line text-muted",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Pane label="TypeScript" note="what this project is built in" code={typescript} hidden={shown !== "typescript"} />
        <Pane label="Rust" note="for comparison — not built here" code={rust} hidden={shown !== "rust"} />
      </div>

      {caption ? <p className="text-sm text-muted">{caption}</p> : null}
    </div>
  );
}

function Pane({ label, note, code, hidden }: { label: string; note: string; code: string; hidden: boolean }) {
  return (
    <figure className={[hidden ? "hidden lg:block" : "block", "min-w-0"].join(" ")}>
      <figcaption className="flex items-baseline gap-2 pb-1">
        <span className="font-display text-sm font-medium text-text">{label}</span>
        <span className="text-xs text-muted">{note}</span>
      </figcaption>
      <pre className="overflow-x-auto rounded-card border border-line bg-surface px-3 py-2">
        <code className="font-mono text-xs leading-relaxed text-text">{code}</code>
      </pre>
    </figure>
  );
}
