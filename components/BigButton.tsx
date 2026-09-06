import type { ButtonHTMLAttributes, ReactNode } from "react";

type BigButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** While true the button is disabled, announces busy state and shows `pendingLabel`. */
  pending?: boolean;
  pendingLabel?: string;
};

/**
 * The one primary action on a screen (constitution P1): full width, yellow,
 * big display type, ≥ 56 px tall so it is an easy tap target.
 */
export function BigButton({
  children,
  pending = false,
  pendingLabel = "One moment…",
  disabled,
  className = "",
  type = "button",
  ...rest
}: BigButtonProps) {
  const isDisabled = disabled || pending;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={[
        "flex min-h-14 w-full items-center justify-center rounded-2xl px-6 py-4",
        "bg-yellow font-display text-xl font-bold text-bg",
        "transition-transform active:scale-[0.98] motion-reduce:transition-none",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        className,
      ].join(" ")}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
