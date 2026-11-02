import "@vscode/codicons/dist/codicon.css";
import { createRoot } from "react-dom/client";
import type { HostMessage } from "./protocol.js";
import { chooseTransport, Root, type VsCodeApi } from "./Root.js";

declare function acquireVsCodeApi(): VsCodeApi;

const listen = (handler: (message: HostMessage) => void): (() => void) => {
  const onMessage = (event: MessageEvent): void => handler(event.data);
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <Root
    build={(onOutput) =>
      chooseTransport(typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined, listen, onOutput)
    }
  />,
);
