/** Minimal runtime stand-in for the `vscode` module. Tests spy on or replace members as needed. */
export const vscodeMock = {
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
