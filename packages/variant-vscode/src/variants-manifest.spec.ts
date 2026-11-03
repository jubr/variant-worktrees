import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

interface Manifest {
  engines: { vscode: string };
  dependencies: Record<string, string>;
  contributes: {
    commands: Array<{ command: string; title: string }>;
    views?: Record<string, Array<{ id: string; name: string; type?: string; when?: string; visibility?: string }>>;
    configuration: { properties: Record<string, { type: string; default?: unknown; markdownDescription?: string }> };
    viewsWelcome?: Array<{ view: string; contents: string; when?: string }>;
    menus?: Record<string, Array<{ command: string; when?: string; group?: string }>>;
  };
}

const manifest: Manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const build = readFileSync(new URL("../scripts/esbuild.config.ts", import.meta.url), "utf8");

describe("variants view manifest", () => {
  describe("host requirement", () => {
    it("needs VS Code 1.101, whose Node.js reads sqlite through node:sqlite", () => {
      expect(manifest.engines.vscode).toBe("^1.101.0");
    });

    it("types against no newer API than that", () => {
      expect(manifest.dependencies["@types/vscode"]).toBe("^1.101.0");
    });

    it("bundles for Node 22", () => {
      expect(build).toContain('target: "node22"');
    });

    it("embeds the library and the app, not the server", () => {
      expect(manifest.dependencies["variant-api"]).toBe("workspace:*");
      expect(manifest.dependencies["variant-ui"]).toBe("workspace:*");
      expect(manifest.dependencies["variant-server"]).toBeUndefined();
    });
  });
});

/** Evaluates the context keys of a `when` clause that these views use: `a && !b && c > 0`. */
const holds = (when: string | undefined, context: Record<string, boolean | number>): boolean =>
  (when ?? "true").split("&&").every((term) => {
    const text = term.trim();
    if (text.startsWith("!")) {
      return !context[text.slice(1)];
    }
    const compared = /^(\w+) > (\d+)$/.exec(text);
    return compared ? Number(context[compared[1] as string] ?? 0) > Number(compared[2]) : Boolean(context[text]);
  });

describe("onboarding manifest", () => {
  const views = manifest.contributes.views?.explorer ?? [];
  const shown = (onboardingOpen: boolean): string[] =>
    views
      .filter((view) => holds(view.when, { workspaceFolderCount: 1, "variant.onboardingOpen": onboardingOpen }))
      .map((view) => view.id);

  it("shows the variants tree while the dialog is closed and the dialog view while it is open, never both", () => {
    expect(shown(false)).toEqual(["variant.variants"]);
    expect(shown(true)).toEqual(["variant.onboarding"]);
  });

  it("names both views alike, so the dialog takes the place of the tree, and makes the dialog a webview", () => {
    const tree = views.find((view) => view.id === "variant.variants");
    const dialog = views.find((view) => view.id === "variant.onboarding");

    expect(dialog?.name).toBe(tree?.name);
    expect(dialog?.type).toBe("webview");
    expect(dialog?.visibility).toBe("visible");
  });

  it("contributes the command with its title and offers it in the palette for a workspace", () => {
    expect(manifest.contributes.commands).toContainEqual({
      command: "variant.onboardingInit",
      title: "Variant: Initialize in this Repo",
    });
    expect(manifest.contributes.menus?.commandPalette).toContainEqual({
      command: "variant.onboardingInit",
      when: "workspaceFolderCount > 0",
    });
  });

  it("has the setting variant.mise.binPath, empty by default, whose description names Mise", () => {
    const setting = manifest.contributes.configuration.properties["variant.mise.binPath"];

    expect(setting?.type).toBe("string");
    expect(setting?.default).toBe("");
    expect(setting?.markdownDescription).toContain("Mise");
  });
});
