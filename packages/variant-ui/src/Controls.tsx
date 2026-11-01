import type { ReactNode } from "react";

/** An icon-only button with an accessible name. */
export const IconButton = ({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button type="button" className="icon-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    <span className={`codicon codicon-${icon}`} aria-hidden="true" />
  </button>
);

export const Busy = () => <span role="status" aria-label="Working" className="codicon codicon-loading busy" />;

export const RowError = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="row-error">
    {children}
  </p>
);
