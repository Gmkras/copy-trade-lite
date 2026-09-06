import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** A raised surface on the black background: subtle border, 16 px radius, no shadow. */
export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={["rounded-card border border-line bg-surface p-4", className].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
