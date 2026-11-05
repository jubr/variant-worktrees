import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

interface MenuEntry {
  command?: string;
  submenu?: string;
  alt?: string;
  when?: string;
  group?: string;
}

interface Manifest {
  engines: { vscode: string };
  dependencies: Record<string, string>;
  contributes: {
    commands: Array<{ command: string; title: string }>;
    viewsContainers?: {
      activitybar?: Array<{ id: string; title: string; icon: string }>;
      panel?: unknown;
    };
    views?: Record<string, Array<{ id: string; name: string; type?: string; when?: string; visibility?: string }>>;
    configuration: { properties: Record<string, { type: string; default?: unknown; markdownDescription?: string }> };
    viewsWelcome?: Array<{ view: string; contents: string; when?: string }>;
    menus?: Record<string, MenuEntry[]>;
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

const eitherView = "(view == variant.variants || view == variant.worktrees)";

const onEitherView = (rest: string): string => (rest === "" ? eitherView : `${eitherView} && ${rest}`);

const menu = (name: "view/title" | "view/item/context"): MenuEntry[] => manifest.contributes.menus?.[name] ?? [];

describe("activity bar manifest", () => {
  it("contributes one Variant Worktrees activity-bar container and no panel container", () => {
    expect(manifest.contributes.viewsContainers?.activitybar).toEqual([
      {
        id: "variantWorktrees",
        title: "Variant Worktrees",
        icon: "media/variant-worktrees-view-icon.svg",
      },
    ]);
    expect(manifest.contributes.viewsContainers?.panel).toBeUndefined();
  });

  it("ships the brand icon and whitelists it for the package", () => {
    const packaged = new URL("../media/variant-worktrees-view-icon.svg", import.meta.url);
    const brand = new URL("../../../assets/brand/variant-worktrees-view-icon.svg", import.meta.url);

    expect(existsSync(packaged)).toBe(true);
    expect(readFileSync(packaged)).toEqual(readFileSync(brand));
    expect(readFileSync(new URL("../.vscodeignore", import.meta.url), "utf8").split("\n")).toContain(
      "!media/variant-worktrees-view-icon.svg",
    );
  });

  it("shows the activity-bar tree for any open folder, including while Explorer shows onboarding", () => {
    const explorer = manifest.contributes.views?.explorer ?? [];
    const explorerShown = (onboardingOpen: boolean): string[] =>
      explorer
        .filter((view) => holds(view.when, { workspaceFolderCount: 1, "variant.onboardingOpen": onboardingOpen }))
        .map((view) => view.id);

    expect(explorerShown(false)).toEqual(["variant.variants"]);
    expect(explorerShown(true)).toEqual(["variant.onboarding"]);

    const activity = manifest.contributes.views?.variantWorktrees ?? [];
    expect(activity).toEqual([
      {
        id: "variant.worktrees",
        name: "Variant Worktrees",
        when: "workspaceFolderCount > 0",
        visibility: "visible",
      },
    ]);

    const activityShown = (onboardingOpen: boolean, folders: number): string[] =>
      activity
        .filter((view) => holds(view.when, { workspaceFolderCount: folders, "variant.onboardingOpen": onboardingOpen }))
        .map((view) => view.id);

    expect(activityShown(true, 1)).toEqual(["variant.worktrees"]);
    expect(activityShown(false, 0)).toEqual([]);
  });

  it("copies both welcome entries, and empty Onboard runs variant.create on each tree", () => {
    const forView = (view: string): Array<{ view: string; contents: string; when?: string }> =>
      (manifest.contributes.viewsWelcome ?? []).filter((entry) => entry.view === view);
    const noConfig = {
      contents: "Variants are not initialized in this workspace.\n[Onboard](command:variant.onboardingInit)",
      when: "variant.noConfig",
    };
    const noVariants = {
      contents: "Variants are not initialized, but no variants created yet.\n[Onboard](command:variant.create)",
      when: "variant.noVariants",
    };

    expect(forView("variant.worktrees")).toEqual([
      { view: "variant.worktrees", ...noConfig },
      { view: "variant.worktrees", ...noVariants },
    ]);
    expect(forView("variant.variants")).toEqual([
      { view: "variant.variants", ...noConfig },
      { view: "variant.variants", ...noVariants },
    ]);
  });

  it("offers the same title and item actions on both trees", () => {
    expect(menu("view/title").map((entry) => entry.when)).toEqual([
      onEitherView(""),
      onEitherView("variant.currentSort == 'name-asc'"),
      onEitherView("variant.currentSort == 'name-desc'"),
      onEitherView("variant.currentSort == 'created-asc'"),
      onEitherView("variant.currentSort == 'created-desc'"),
      onEitherView("variant.currentSort == 'changed-asc'"),
      onEitherView("variant.currentSort == 'changed-desc'"),
      onEitherView(""),
      onEitherView(""),
    ]);
    expect(menu("view/item/context").map((entry) => entry.when)).toEqual([
      onEitherView("viewItem =~ /^variant (down|up|watching) .*has-url/"),
      onEitherView("viewItem =~ /^variant down( |$)/"),
      onEitherView("viewItem =~ /^variant (watching|up)( |$)/"),
      onEitherView("viewItem =~ /^variant (down|up|watching) removable/ && viewItem =~ / clean/"),
      onEitherView("viewItem =~ /^variant (down|up|watching) removable/ && viewItem =~ / dirty/"),
      onEitherView("viewItem =~ /^variant (down|up|watching) .*has-log/"),
      onEitherView("viewItem =~ /^variant (down|up|watching) .*has-url/"),
      onEitherView("viewItem =~ /^variant (down|up|watching) /"),
      onEitherView("viewItem =~ /^variant (down|up|watching) /"),
      onEitherView("viewItem =~ /^ui-server$/"),
      onEitherView("viewItem =~ /^ui-server$/"),
    ]);
  });
});
