import type { ReactNode } from "react";

const ExplodeIcon = () => (
  <svg className="explode-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M8 0l1.2 4.2L13.5 2 11 6.2 16 8l-5 1.8L13.5 14 9.2 11.8 8 16l-1.2-4.2L2.5 14 5 9.8 0 8l5-1.8L2.5 2 6.8 4.2z"
    />
  </svg>
);

/** An icon-only button with an accessible name. `explode` is the monochrome explosion glyph. */
export const IconButton = ({
  icon,
  label,
  disabled,
  onClick,
  className,
}: {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    className={className === undefined ? "icon-button" : `icon-button ${className}`}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    {icon === "explode" ? <ExplodeIcon /> : <span className={`codicon codicon-${icon}`} aria-hidden="true" />}
  </button>
);

export const Busy = () => <span role="status" aria-label="Working" className="codicon codicon-loading busy" />;

export const RowError = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="row-error">
    {children}
  </p>
);
