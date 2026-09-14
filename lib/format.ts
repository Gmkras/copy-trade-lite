/** Display helpers. Client-safe. Every number shown to a user gets context (constitution P3). */

/** 1234.5 → "1,234.50". No currency symbol so callers can write "$" or "USDC". */
export function money(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 0.00002 → "0.00002", 1 → "1"; up to 8 decimals, trailing zeros trimmed. */
export function amount(value: number, maxDecimals = 8): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(maxDecimals)).toString();
}

/** 0.032 → "+3.2%", -0.011 → "-1.1%". */
export function pct(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "—";
  const value = fraction * 100;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** Signed dollars: 12.3 → "+$12.30", -4 → "-$4.00". */
export function signedMoney(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${money(Math.abs(value), digits)}`;
}

/**
 * Big figures at a glance: 223840 → "223.8K", 2.3e9 → "2.3B". For volume and
 * open interest, where the magnitude matters and the last digits do not.
 */
export function compact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return money(value, 1);
}

/** 3600 → "1h", 28800 → "8h", 900 → "15m". The funding period, in plain words. */
export function everyLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${Math.round(seconds)}s`;
}

/** Unix ms → "just now", "12s ago", "5m ago", "3h ago", "2d ago". */
export function timeAgo(unixMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - unixMs) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** "BTC/USD" → "BTC". */
export function symbolOf(marketName: string): string {
  return marketName.split("/")[0] || marketName;
}
