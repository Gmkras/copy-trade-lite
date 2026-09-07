"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Tab = { href: string; label: string; icon: ReactNode };

/** 20 px line icons, drawn inline so the app ships no icon dependency. */
const FeedIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="14" width="18" height="6" rx="2" />
  </svg>
);

const TradeIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 17V9m0 0 3 3M7 9 4 12" />
    <path d="M17 7v8m0 0-3-3m3 3 3-3" />
  </svg>
);

const TABS: Tab[] = [
  { href: "/", label: "Feed", icon: FeedIcon },
  { href: "/trade", label: "Trade", icon: TradeIcon },
];

/**
 * The app's two tabs, in the place each viewport expects (constitution P4,
 * design D3): a bottom bar on phones — opaque, with room for the device's
 * home indicator — and a top bar from 1024 px, with the wordmark and a
 * reminder that this is play money. The active tab is the only yellow
 * element in the bar.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={[
        "fixed inset-x-0 z-30 border-line bg-bg",
        // Phones: bottom bar, opaque (a blurred bar let the cards bleed through).
        "bottom-0 border-t pb-[env(safe-area-inset-bottom)]",
        // Wide: the same tabs at the top, with the wordmark.
        "lg:bottom-auto lg:top-0 lg:border-b lg:border-t-0 lg:pb-0",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-lg items-center lg:max-w-6xl lg:justify-between lg:px-6">
        <span className="hidden font-display text-lg font-bold lg:block">Copy-Trade Lite</span>

        <ul className="flex flex-1 lg:flex-none lg:gap-2">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <li key={tab.href} className="flex-1 lg:flex-none">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 font-display text-sm font-medium",
                    "lg:min-h-16 lg:flex-row lg:gap-2 lg:px-4 lg:text-base",
                    active ? "text-yellow" : "text-muted hover:text-text",
                  ].join(" ")}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <span className="hidden text-sm text-muted lg:block">play money · testnet</span>
      </div>
    </nav>
  );
}
