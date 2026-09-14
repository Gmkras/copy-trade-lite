"use client";

import { useState } from "react";

import { QUIZ } from "@/lib/learn/content";
import { score } from "@/lib/learn/simulate";

/**
 * Six questions, marked as you go.
 *
 * Green and red mean right and wrong here and nowhere else on the page; the
 * one yellow thing is the button that starts again (constitution P1).
 */
export function Quiz() {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const chosen = QUIZ.filter((q) => answers[q.id] !== undefined).map((q) => ({
    chosen: answers[q.id] as number,
    correct: q.correct,
  }));
  const result = score(chosen, QUIZ.length);
  const done = chosen.length === QUIZ.length;

  return (
    <section aria-label="Check what you took away" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl">Did any of it stick?</h2>
        <p className="font-display tabular-nums text-muted" aria-live="polite">
          <span className="text-text">{result.correct}</span> / {result.total}
        </p>
      </div>

      <ol className="flex flex-col gap-5">
        {QUIZ.map((q, index) => {
          const answered = answers[q.id];
          const isAnswered = answered !== undefined;
          return (
            <li key={q.id} className="flex flex-col gap-2">
              <p className="font-display font-medium">
                <span className="text-muted">{index + 1}. </span>
                {q.question}
              </p>
              <div role="group" aria-label={q.question} className="flex flex-col gap-1.5">
                {q.options.map((option, i) => {
                  const picked = answered === i;
                  const right = i === q.correct;
                  // Before answering, nothing is coloured: the colours are the
                  // feedback, not decoration.
                  const tone = !isAnswered
                    ? "border-line text-text hover:border-muted"
                    : right
                      ? "border-up/60 text-up"
                      : picked
                        ? "border-down/60 text-down"
                        : "border-line text-muted";
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isAnswered}
                      aria-pressed={picked}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                      className={[
                        "flex min-h-11 items-center gap-2 rounded-card border px-3 py-2 text-left text-sm transition-colors",
                        tone,
                      ].join(" ")}
                    >
                      <span aria-hidden className="w-4 shrink-0 font-mono text-xs">
                        {isAnswered ? (right ? "✓" : picked ? "✕" : "") : String.fromCharCode(97 + i)}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
              {isAnswered ? (
                <p className="text-sm text-muted">{q.explanation}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {done ? (
        <button
          type="button"
          onClick={() => setAnswers({})}
          className="min-h-12 self-start rounded-2xl bg-yellow px-5 font-display text-base font-bold text-bg"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
