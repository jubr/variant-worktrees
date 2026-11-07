export {};

declare module "vscode" {
  export namespace cursor {
    export namespace mcp {
      export interface StdioServerConfig {
        name: string;
        server: {
          command: string;
          args: string[];
          env: Record<string, string>;
        };
      }

      export function registerServer(config: StdioServerConfig): void;
      export function unregisterServer(serverName: string): void;
    }
  }
}
