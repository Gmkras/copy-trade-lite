import { subscribeLive, type LiveEvent } from "@/lib/decibel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The platform will not let one request run forever. Two numbers, deliberately
 * different: `maxDuration` is what we ask the host for, and `WINDOW_MS` is when
 * we close the stream ourselves — comfortably earlier, so the connection ends
 * cleanly on our terms instead of being cut mid-event. `EventSource` reconnects
 * on its own after `RETRY_MS`, so the viewer sees one continuous stream.
 */
export const maxDuration = 60;
const WINDOW_MS = 50_000;
const RETRY_MS = 3_000;
/** A comment line often enough that no proxy considers the connection idle. */
const PING_MS = 15_000;

/**
 * GET /api/stream — Server-Sent Events with what the exchange publishes.
 *
 * Two kinds of event: `price` carries a market's mid and mark, and `account` is
 * empty on purpose — it means "something changed, ask `/api/account` again", so
 * this channel never exposes a balance, a position or an address. It is a read
 * route: open, like the others, and it accepts no input at all.
 */
export function GET(request: Request): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between our check and this write.
          closed = true;
        }
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearTimeout(window);
        request.signal.removeEventListener("abort", finish);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the platform; nothing to do.
        }
      };

      // Tell the browser how soon to come back before anything else.
      send(`retry: ${RETRY_MS}\n\n`);
      send(`event: hello\ndata: {"ok":true}\n\n`);

      const unsubscribe = subscribeLive((event: LiveEvent) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const ping = setInterval(() => send(`: ping\n\n`), PING_MS);
      const window = setTimeout(() => {
        send(`event: bye\ndata: {"reason":"window"}\n\n`);
        finish();
      }, WINDOW_MS);

      request.signal.addEventListener("abort", finish);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Proxies that buffer would defeat the whole point.
      "x-accel-buffering": "no",
    },
  });
}
