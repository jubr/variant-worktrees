import { useState } from "react";
import { App } from "./App.js";
import { createHttpTransport } from "./http-transport.js";
import { OutputDialog } from "./OutputDialog.js";
import { createWebviewTransport, type HostMessage, type MessagePort, type WebviewMessage } from "./protocol.js";
import type { Transport } from "./transport.js";
import { TransportProvider } from "./transport-context.js";

/** What the editor puts on the page of a webview. */
export interface VsCodeApi {
  postMessage(message: unknown): void;
}

/** The transport the page has: the editor's message channel inside a webview, the server's HTTP API in a browser. */
export const chooseTransport = (
  vscode: VsCodeApi | undefined,
  listen: (handler: (message: HostMessage) => void) => () => void,
  onOutput: (slug: string, text: string) => void,
): Transport => {
  if (vscode === undefined) {
    return createHttpTransport({ onOutput });
  }
  const port: MessagePort<WebviewMessage, HostMessage> = { post: (message) => vscode.postMessage(message), listen };
  return createWebviewTransport(port);
};

/** The app over a transport, with the dialog that shows a variant's output when the transport reports it. */
export const Root = ({ build }: { build: (onOutput: (slug: string, text: string) => void) => Transport }) => {
  const [output, setOutput] = useState<{ slug: string; text: string } | undefined>();
  const [transport] = useState(() => build((slug, text) => setOutput({ slug, text })));
  return (
    <TransportProvider transport={transport}>
      <App />
      {output ? <OutputDialog slug={output.slug} text={output.text} onClose={() => setOutput(undefined)} /> : null}
    </TransportProvider>
  );
};
