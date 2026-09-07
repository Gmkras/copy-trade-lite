"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The one breakpoint where the layout becomes two columns (design D1). */
export const WIDE = "(min-width: 1024px)";

/**
 * Whether a CSS media query matches, safe for server rendering.
 *
 * The server snapshot is always `false`, so the server and the first client
 * render agree on the phone layout and React never warns about a mismatch;
 * the wide layout appears right after hydration. Use it only where the DOM
 * itself must differ (what to fetch, a numeric prop) — everything that CSS
 * can express stays a Tailwind `lg:` variant.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
