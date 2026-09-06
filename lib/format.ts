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
