import { useEffect, useRef } from "react";

/** Asks before a variant is removed for good; the person accepts, cancels, or dismisses it with Escape. */
export const ImplodeDialog = ({
  slug,
  onAccept,
  onCancel,
}: {
  slug: string;
  onAccept: () => void;
  onCancel: () => void;
}) => {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="implode-title"
        className="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
      >
        <h2 id="implode-title">Implode {slug}?</h2>
        <p>
          This removes the database target, the worktree, and the branch of <strong>{slug}</strong>. It cannot be
          undone.
        </p>
        <div className="dialog-actions">
          <button type="button" ref={cancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" aria-label={`Implode ${slug} permanently`} onClick={onAccept}>
            Implode
          </button>
        </div>
      </div>
    </div>
  );
};
