import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedRail } from "@/components/FeedRail";
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
    // From 1024 px the list of ideas sits beside the open one, so a reader can
    // move between ideas without going back (design D2).
    <main className="mx-auto w-full max-w-lg flex-1 p-6 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <FeedRail currentId={data.signal.id} />
      <div className="flex flex-col gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center self-start pr-3 text-sm text-muted hover:text-text lg:hidden">
          ← All ideas
        </Link>
        <SignalDetail initialSignal={data.signal} initialCopies={data.copies} />
      </div>
    </main>
  );
}
