/** Minimal runtime stand-in for the `vscode` module. Tests spy on or replace members as needed. */
type TitleListener = (change: { sessionId: string; title?: string }) => void;

export const vscodeMock = {
  /** Unset outside an editor host. A test sets `appName` to make the extension believe it runs in one. */
  env: { appName: undefined as string | undefined, uriScheme: "cursor" },
  extensions: {
    getExtension: (_id: string): { packageJSON: unknown } | undefined => undefined,
  },
  /** Cursor's private API object. A test installs the members it needs. */
  cursor: {} as {
    onDidChangeAgentHostSessionCatalogTitle?: (listener: TitleListener) => { dispose(): void };
    listAgentHostSessionCatalog?: (limit?: number) => Promise<Array<{ sessionId: string; title?: string }>>;
    projectAgentHostSessionTitle?: (sessionId: string, title: string) => Promise<void>;
  },
  commands: {
    registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => ({ dispose: () => {} }),
    executeCommand: async (..._args: unknown[]): Promise<unknown> => undefined,
  },
  window: {
    createOutputChannel: (_name: string) => ({ appendLine: (_line: string) => {}, dispose: () => {} }),
    registerUriHandler: (_handler: unknown) => ({ dispose: () => {} }),
    showErrorMessage: async (..._args: unknown[]) => undefined,
    showWarningMessage: async (..._args: unknown[]) => undefined,
  },
  workspace: {
    getConfiguration: (_section: string) => ({ get: (_key: string): unknown => undefined }),
    onDidChangeConfiguration: (_listener: unknown) => ({ dispose: () => {} }),
    workspaceFolders: undefined as undefined | Array<{ uri: { fsPath: string } }>,
  },
};
