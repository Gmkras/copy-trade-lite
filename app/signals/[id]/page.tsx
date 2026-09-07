import Link from "next/link";
import { notFound } from "next/navigation";

import { SignalDetail } from "@/components/SignalDetail";
import { isExpired, signalsRepo } from "@/lib/signals";

export const dynamic = "force-dynamic";

/** Reads the signal from the database (not a component, so it may read the clock). */
async function loadSignal(id: string) {
  const repo = signalsRepo();
  const signal = await repo.getSignal(id);
  if (!signal) return null;
  return { signal: { ...signal, expired: isExpired(signal, Date.now()) }, copies: await repo.listCopies(id) };
}

export default async function SignalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadSignal(id);
  if (!data) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <Link href="/" className="inline-flex min-h-11 items-center self-start pr-3 text-sm text-muted hover:text-text">
        ← All ideas
      </Link>
      <SignalDetail initialSignal={data.signal} initialCopies={data.copies} />
    </main>
  );
}
