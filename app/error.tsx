"use client";

/**
 * Last-resort screen for a server render that threw (for example, the signal
 * store being unreachable). It shows what happened and what to do next, never
 * the error text: that could carry a connection string or a stack.
 */
export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6">
      <div className="rounded-card border border-line bg-surface p-6 text-center">
        <p className="font-display text-lg">Something went wrong on our side</p>
        <p className="mt-1 text-sm text-muted">
          This screen couldn&apos;t load. Nothing was placed or changed. Try again, or use the Trade tab in the meantime.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 min-h-11 rounded-full border border-text px-4 font-display text-base font-medium text-text"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
