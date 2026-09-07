import { money } from "@/lib/format";
import type { OrderSide } from "@/lib/schemas";
import { ideaProgress, progressSentence } from "@/lib/signals/math";

type IdeaStripProps = {
  side: OrderSide;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  expired: boolean;
  /** Live mid of the market, or null when it could not be read. */
  livePrice: number | null;
};

const W = 320;
const H = 64;
const TRACK_Y = 36;

/**
 * The idea as a picture: stop loss on the left, entry in between, take profit
 * on the right, and a yellow "now" dot where the price is. Left is always
 * where the idea stops and right is always where it wins, for Up and Down
 * alike (design D1); the headline carries the direction. Pure: everything is
 * derived from the four prices, nothing is fetched here.
 */
export function IdeaStrip({ side, entryPrice, tpPrice, slPrice, expired, livePrice }: IdeaStripProps) {
  const levels = { side, entryPrice, tpPrice, slPrice };
  const progress = ideaProgress(levels, expired ? null : livePrice);
  const sentence = progressSentence({ ...levels, expired }, livePrice);
  const digits = entryPrice >= 100 ? 0 : 2;

  const entryX = progress.entryPos * W;
  // The entry label floats near its tick but never over the end labels
  // (an idea with TP 10 % / SL 1 % puts the entry a tenth of the way in).
  const entryLabelX = Math.min(W - 70, Math.max(70, entryX));
  const nowX = progress.nowPos === null ? null : Math.min(W - 14, Math.max(14, progress.nowPos * W));

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={sentence}>
        {/* Level names */}
        <text x={0} y={11} fontSize={10} fill="var(--color-down)">Stop loss</text>
        <text x={W} y={11} fontSize={10} fill="var(--color-up)" textAnchor="end">Take profit</text>

        {/* Track: red from the stop to the entry, green from the entry to the take profit */}
        <rect x={0} y={TRACK_Y - 3} width={W} height={6} rx={3} fill="var(--color-line)" />
        <rect x={0} y={TRACK_Y - 3} width={entryX} height={6} rx={3} fill="var(--color-down)" opacity={0.55} />
        <rect x={entryX} y={TRACK_Y - 3} width={W - entryX} height={6} rx={3} fill="var(--color-up)" opacity={0.55} />
        <rect x={entryX - 1.5} y={TRACK_Y - 9} width={3} height={18} rx={1.5} fill="var(--color-yellow)" />

        {/* Where the price is now */}
        {nowX !== null ? (
          <g>
            <rect x={nowX - 15} y={15} width={30} height={13} rx={6.5} fill="var(--color-yellow)" />
            <text x={nowX} y={24.5} fontSize={9} fontWeight={700} fill="var(--color-bg)" textAnchor="middle">now</text>
            <circle cx={nowX} cy={TRACK_Y} r={6} fill="var(--color-yellow)" stroke="var(--color-bg)" strokeWidth={2} />
          </g>
        ) : null}

        {/* Prices */}
        <text x={0} y={H - 4} fontSize={10} fill="var(--color-muted)">${money(slPrice, digits)}</text>
        <text x={entryLabelX} y={H - 4} fontSize={10} fontWeight={700} fill="var(--color-yellow)" textAnchor="middle">
          Entry ${money(entryPrice, digits)}
        </text>
        <text x={W} y={H - 4} fontSize={10} fill="var(--color-muted)" textAnchor="end">${money(tpPrice, digits)}</text>
      </svg>
      <p className="text-sm text-muted" aria-hidden>
        {sentence}
      </p>
    </div>
  );
}
