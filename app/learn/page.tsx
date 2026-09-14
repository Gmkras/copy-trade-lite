import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CodeCompare } from "@/components/learn/CodeCompare";
import { DepthSlider } from "@/components/learn/DepthSlider";
import { MemoryVisualizer } from "@/components/learn/MemoryVisualizer";
import { PacketRace } from "@/components/learn/PacketRace";
import { Quiz } from "@/components/learn/Quiz";

export const metadata: Metadata = {
  title: "Three questions — Copy-Trade Lite",
  description: "Stack and heap, stack overflow, TCP and UDP, explained with a trading app's own code.",
};

/**
 * Not part of the product. This page answers three questions that come up in
 * most engineering interviews, using this app's own code because it happens to
 * contain all three. It is reachable only by typing its address: nothing links
 * to it, and the navigation bar keeps its two tabs with neither highlighted.
 *
 * A Server Component with no data to fetch — the interactives are the only
 * client code here (design D6).
 */
export default function LearnPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-10 p-6 lg:max-w-4xl lg:gap-14">
      <header className="flex flex-col gap-2">
        <p className="font-display text-sm text-muted">Not part of the app</p>
        <h1 className="text-3xl lg:text-4xl">Three questions, answered with a trading app</h1>
        <p className="text-muted">
          Stack and heap, stack overflow, TCP and UDP. Every example below is real code from Copy-Trade Lite, because
          it turns out a copy-trade app contains all three. Try each thing before reading about it.
        </p>
      </header>

      <Section
        n={1}
        title="Stack and heap"
        anchor="The stack is the order you are placing. The heap is the position you are left with."
      >
        <MemoryVisualizer />

        <Prose>
          <p>
            Both live in your program&apos;s memory, and the difference is who decides when they end. A{" "}
            <b className="text-text">stack</b> frame is created by calling a function and destroyed by returning from
            it — strictly last in, first out, with a size the compiler already knew. The{" "}
            <b className="text-text">heap</b> holds things whose size is only known while the program runs, and it
            outlives the frame that created it.
          </p>
          <p>
            In TypeScript you do not choose. A number is a value; an array or an object is a reference to something on
            the heap, and V8&apos;s collector frees it whenever it gets round to it. In Rust you do choose, and the
            compiler holds you to it: a <code className="font-mono text-xs">Vec</code> keeps its length and capacity on
            the stack and its elements on the heap, and the whole thing is freed the moment its owner goes out of
            scope. No collector, and a moment you can point at.
          </p>
        </Prose>

        <CodeCompare
          caption="The same two kinds of value. On the left the runtime decides when the array dies; on the right the scope does."
          typescript={`const mid = 79_332;            // a number, in the frame
const candles = await getCandles();  // 240 objects, on the heap
// \`candles\` is a reference; the data is freed
// whenever V8's collector next runs.`}
          rust={`let mid: f64 = 79_332.0;       // 8 bytes, in the frame
let candles: Vec<Candle> = get_candles();
// ptr + len + capacity live in the frame,
// the elements on the heap — freed when
// \`candles\` goes out of scope. Exactly then.`}
        />

        <InApp>
          The order you place crosses both models. You sign it from TypeScript, where a collector owns the memory, and
          a node written in Rust validates it, where scope does. Same bytes, two philosophies.
        </InApp>

        <Remember>
          Fixed and automatic, or elastic and owned. If its size is only known at run time, it is on the heap.
        </Remember>
      </Section>

      <Section
        n={2}
        title="Stack overflow"
        anchor="An order that keeps copying itself."
      >
        <DepthSlider />

        <Prose>
          <p>
            The stack is small and fixed — about a megabyte on V8&apos;s main thread, eight on a Rust main thread, two
            on one you spawn. The heap is large and elastic. An overflow is what happens when you confuse them: you
            put on the stack something whose size depends on the input.
          </p>
          <p>
            Almost always that means recursion with no bound, and the dangerous version is the one whose depth comes
            from data — it passes every test you wrote and fails on the day someone asks for a longer range. Neither
            language will save you: V8 never shipped tail-call optimisation although ES2015 specified it, and Rust
            does not guarantee it either. The fix in both is the same: a loop, or an explicit stack on the heap.
          </p>
          <p>
            Rust does catch one version of this at compile time. A recursive <i>type</i> has no finite size, so it
            refuses to compile until you put the recursion behind a{" "}
            <code className="font-mono text-xs">Box</code> — which is to say, until you move it to the heap. It is the
            same distinction as the section above, showing up in the type system.
          </p>
        </Prose>

        <CodeCompare
          caption="A recursive type has infinite size. Boxing it moves the child to the heap, where a pointer of known size can stand in for it."
          typescript={`// TypeScript accepts this type. You just
// can never build one — it has no base case.
type PriceTree = { lo: PriceTree; hi: PriceTree };

function scan(c: Candle[], i = 0): number {
  if (i >= c.length) return 0;
  return scan(c, i + 1);   // one frame per candle
}`}
          rust={`enum PriceTree { Node(PriceTree, PriceTree) }
// error[E0072]: recursive type has infinite size

enum PriceTree {
  Node(Box<PriceTree>, Box<PriceTree>),
}
// ✓ a Box is a pointer, and a pointer has a size`}
        />

        <InApp>
          <code className="font-mono text-xs">settleSignal</code> walks an idea&apos;s candles with a{" "}
          <code className="font-mono text-xs">for</code> loop, not recursion, because the number of candles comes from
          how long the idea has been open. And in product terms the same failure has a name: if copying an idea
          produced another copyable idea, a copy could copy itself forever. A copy-trade platform has to refuse the
          cycle.
        </InApp>

        <Remember>
          The stack is small and fixed. If the depth depends on the input, it belongs in a loop.
        </Remember>
      </Section>

      <Section
        n={3}
        title="TCP and UDP"
        anchor="The order must arrive. The price only has to be the latest one."
      >
        <PacketRace />

        <Prose>
          <p>
            <b className="text-text">TCP</b> sets up a connection, numbers everything it sends, and retransmits
            whatever goes missing. You get every byte, in order. <b className="text-text">UDP</b> does none of that: it
            addresses a datagram and sends it, and if it is lost, it is lost.
          </p>
          <p>
            That makes TCP the obvious choice — until you notice what its guarantee costs. While a lost packet is
            retransmitted, everything behind it waits, even though those packets already arrived. That is{" "}
            <i>head-of-line blocking</i>, and for prices it is exactly backwards: a quote from 200 ms ago that finally
            gets through is worthless, and it delayed three fresher ones to get there. This is why exchange
            market-data feeds are multicast UDP, and why QUIC — and so HTTP/3 — was built on UDP rather than TCP.
          </p>
          <p>
            One catch: a browser cannot speak UDP at all. It has HTTP, WebSocket and WebRTC, and nothing else. So a web
            app that wants UDP&apos;s semantics has to build them on top of a TCP pipe.
          </p>
        </Prose>

        <CodeCompare
          caption="Rust hands you either protocol directly. In a browser you get neither, so the semantics have to be built on what you do have."
          typescript={`// Node has both:
import { createSocket } from "node:dgram";  // UDP
import { createServer } from "node:net";    // TCP

// A browser has neither — only HTTP,
// WebSocket and WebRTC.`}
          rust={`use std::net::{TcpStream, UdpSocket};

let orders = TcpStream::connect(venue)?;   // must arrive
let prices = UdpSocket::bind("0.0.0.0:0")?; // must be fresh`}
        />

        <InApp>
          Orders go over HTTP, so TCP: one that arrives twice is a financial bug. Prices come over server-sent events,
          also TCP — but <code className="font-mono text-xs">useLive</code> treats them the UDP way, keeping only the
          newest mid per market in a ref and flushing once per animation frame. Intermediate values are dropped on
          purpose. That is &quot;last value wins&quot;, which is the semantics a UDP feed would have given us for free.
        </InApp>

        <Remember>
          Guaranteed and ordered, or fast and lossy. Ask what a late message is worth: for an order, everything; for a
          price, nothing.
        </Remember>
      </Section>

      <Quiz />

      <footer className="border-t border-line pt-5 text-sm text-muted">
        <p>
          The Rust on this page is quoted for comparison. This project is entirely TypeScript — there is no Rust file
          in it and nothing here is compiled.
        </p>
      </footer>
    </main>
  );
}

/** A question: one sentence, then the thing to operate, then why. */
function Section({ n, title, anchor, children }: { n: number; title: string; anchor: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-display text-sm text-muted">Question {n}</p>
        <h2 className="text-2xl lg:text-3xl">{title}</h2>
        {/* Not yellow: on this page the one yellow thing is the quiz's retry,
            the only action there is (constitution P1). */}
        <p className="font-display text-lg font-medium text-text lg:text-xl">{anchor}</p>
      </div>
      {children}
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 leading-relaxed text-muted">{children}</div>;
}

function InApp({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <p className="font-display text-sm font-medium text-text">In Copy-Trade Lite</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Remember({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-text pl-3 font-display font-medium text-text">
      <span className="text-muted">If you remember nothing else — </span>
      {children}
    </p>
  );
}
