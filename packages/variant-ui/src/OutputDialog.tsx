import { useEffect, useRef } from "react";

/** The tail of a variant's log, for the page that cannot open a file in an editor. */
export const OutputDialog = ({ slug, text, onClose }: { slug: string; text: string; onClose: () => void }) => {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div className="backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="output-title"
        className="dialog output"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          }
        }}
      >
        <h2 id="output-title">Output of {slug}</h2>
        <pre className="log">{text === "" ? "The log is empty." : text}</pre>
        <div className="dialog-actions">
          <button type="button" ref={close} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
