import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { schemaHeaderFor } from "variant-config";
import * as vscode from "vscode";
import { createConfigMigration } from "./config-migration.ts";
import { fakeClient, record } from "./variants-test-support.ts";
import { registerVariantsView } from "./variants-view.ts";

const showWarningMessage = spyOn(vscode.window, "showWarningMessage");
const showTextDocument = spyOn(vscode.window, "showTextDocument");
const openTextDocument = spyOn(vscode.workspace, "openTextDocument");

const HEADER = schemaHeaderFor("variants.yaml");
const LOCAL_HEADER = schemaHeaderFor("variants.local.yaml");
// AIDEV-NOTE: the fixtures carry the schema header so the tests of the renames see no header change; the last describe covers it
const BARE_OLD = "db:\n  dialect: sqlite\nvariant:\n  instances:\n    be: { kind: nestjs, dir: . }\n";
const BARE_NEW = "db:\n  dialect: sqlite\nvariant:\n  watches:\n    be: { kind: nestjs, dir: . }\n";
const OLD = `${HEADER}\n\n${BARE_OLD}`;
const NEW = `${HEADER}\n\n${BARE_NEW}`;
// AIDEV-NOTE: an empty CI counts as unset; a CI runner sets CI=true, which turns the rewrite off
const ENV = { CI: "" };

const directories: string[] = [];

/** A git repository with `variants.yaml` committed (or only written) and the optional git-ignored local file. */
const project = (
  yaml: string,
  options: { committed?: boolean; local?: string } = {},
): { root: string; file: string } => {
  const root = mkdtempSync(join("/tmp", "variant-vscode-migrate-"));
  directories.push(root);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "variant@example.test");
  git("config", "user.name", "Variant Tests");
  writeFileSync(join(root, ".gitignore"), "variants.local.yaml\n");
  const file = join(root, "variants.yaml");
  writeFileSync(file, yaml);
  if (options.committed ?? true) {
    git("add", ".");
    git("commit", "-q", "-m", "initial");
  }
  if (options.local !== undefined) {
    writeFileSync(join(root, "variants.local.yaml"), options.local);
  }
  return { root, file };
};

beforeEach(() => {
  for (const mocked of [showWarningMessage, showTextDocument, openTextDocument]) {
    mocked.mockClear();
  }
  showWarningMessage.mockImplementation((async () => undefined) as never);
  showTextDocument.mockImplementation((async () => undefined) as never);
  openTextDocument.mockImplementation((async () => ({})) as never);
});

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("configuration migration in the extension", () => {
  it("rewrites a tracked clean variants.yaml and shows one warning with the action Open file", () => {
    const { root, file } = project(OLD);

    createConfigMigration({ root, env: ENV }).run();

    expect(readFileSync(file, "utf8")).toBe(NEW);
    expect(showWarningMessage).toHaveBeenCalledTimes(1);
    const [message, ...actions] = showWarningMessage.mock.calls[0] as unknown as string[];
    expect(message).toContain(file);
    expect(message).toContain("git");
    expect(actions).toEqual(["Open file", "Undo"]);
  });

  it("opens the file when the user picks Open file", async () => {
    const { root, file } = project(OLD);
    showWarningMessage.mockImplementation((async () => "Open file") as never);

    createConfigMigration({ root, env: ENV }).run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openTextDocument).toHaveBeenCalledTimes(1);
    expect((openTextDocument.mock.calls[0] as unknown as [{ fsPath: string }])[0].fsPath).toBe(file);
    expect(showTextDocument).toHaveBeenCalledTimes(1);
  });

  it("puts the old text back when the user picks Undo, and says so", async () => {
    const { root, file } = project(OLD);
    showWarningMessage.mockImplementation((async () => "Undo") as never);
    const showInformationMessage = spyOn(vscode.window, "showInformationMessage");
    showInformationMessage.mockClear();
    showInformationMessage.mockImplementation((async () => undefined) as never);

    createConfigMigration({ root, env: ENV }).run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(readFileSync(file, "utf8")).toBe(OLD);
    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    expect((showInformationMessage.mock.calls[0] as unknown as [string])[0]).toContain("VARIANT_MIGRATE=0");
  });

  it("removes the backup of an untracked file on Undo, so the next rewrite can save its own", async () => {
    const { root, file } = project(OLD, { committed: false });
    showWarningMessage.mockImplementation((async () => "Undo") as never);

    createConfigMigration({ root, env: ENV }).run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(readFileSync(file, "utf8")).toBe(OLD);
    expect(existsSync(`${file}~`)).toBe(false);
  });

  it("leaves a file the user changed since the rewrite alone on Undo, and says so", async () => {
    const { root, file } = project(OLD);
    showWarningMessage.mockImplementation((async () => {
      writeFileSync(file, `${NEW}# edited\n`);
      return "Undo";
    }) as never);
    const showErrorMessage = spyOn(vscode.window, "showErrorMessage");
    showErrorMessage.mockClear();
    showErrorMessage.mockImplementation((async () => undefined) as never);

    createConfigMigration({ root, env: ENV }).run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(readFileSync(file, "utf8")).toBe(`${NEW}# edited\n`);
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it("does not open anything when the notification is closed", async () => {
    const { root } = project(OLD);

    createConfigMigration({ root, env: ENV }).run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openTextDocument).not.toHaveBeenCalled();
  });

  it("shows no second notification for the same file in a session", () => {
    const { root } = project(OLD);
    const migration = createConfigMigration({ root, env: { ...ENV, CI: "true" } });

    migration.run();
    migration.run();

    expect(showWarningMessage).toHaveBeenCalledTimes(1);
  });

  it("rewrites an untracked file after saving a backup, and names the backup in the warning", () => {
    const { root, file } = project(OLD, { committed: false });

    createConfigMigration({ root, env: ENV }).run();

    expect(readFileSync(file, "utf8")).toBe(NEW);
    expect(readFileSync(`${file}~`, "utf8")).toBe(OLD);
    const [message, ...actions] = showWarningMessage.mock.calls[0] as unknown as string[];
    expect(message).toContain("not tracked");
    expect(message).toContain(`${file}~`);
    expect(actions).toEqual(["Open file", "Undo"]);
  });

  it("names the reason and keeps the file when it is not rewritten", () => {
    const { root, file } = project(OLD);
    writeFileSync(file, `${OLD}# my edit\n`);

    createConfigMigration({ root, env: ENV }).run();

    expect(readFileSync(file, "utf8")).toBe(`${OLD}# my edit\n`);
    const [message, ...actions] = showWarningMessage.mock.calls[0] as unknown as string[];
    expect(message).toContain("uncommitted");
    expect(actions).toEqual(["Open file"]);
  });

  it("shows one warning per file, for variants.yaml and variants.local.yaml", () => {
    const { root } = project(OLD, { local: `${LOCAL_HEADER}\n\nruntime:\n  instances:\n    be: { port: 62060 }\n` });

    createConfigMigration({ root, env: ENV }).run();

    expect(showWarningMessage).toHaveBeenCalledTimes(2);
  });

  it("shows nothing for a current configuration", () => {
    const { root } = project(NEW);

    createConfigMigration({ root, env: ENV }).run();

    expect(showWarningMessage).not.toHaveBeenCalled();
  });

  it("shows nothing and does not throw for a folder without configuration", () => {
    const root = mkdtempSync(join("/tmp", "variant-vscode-migrate-empty-"));
    directories.push(root);

    expect(() => createConfigMigration({ root, env: ENV }).run()).not.toThrow();
    expect(showWarningMessage).not.toHaveBeenCalled();
  });

  it("does not throw when the configuration cannot be loaded", () => {
    const { root } = project("variant: [\n");

    expect(() => createConfigMigration({ root, env: ENV }).run()).not.toThrow();
  });
});

describe("the schema header in the extension", () => {
  it("adds the header to a current file that has none and tells the user, with Undo", () => {
    const { root, file } = project(BARE_NEW);

    createConfigMigration({ root, env: ENV }).run();

    expect(readFileSync(file, "utf8")).toBe(NEW);
    const [message, ...actions] = showWarningMessage.mock.calls[0] as unknown as string[];
    expect(message).toContain(file);
    expect(message).toContain("schema header");
    expect(actions).toEqual(["Open file", "Undo"]);
  });

  it("stays silent when the header cannot be added, because it is only cosmetic", () => {
    const { root, file } = project(BARE_NEW);

    createConfigMigration({ root, env: { CI: "true" } }).run();

    expect(readFileSync(file, "utf8")).toBe(BARE_NEW);
    expect(showWarningMessage).not.toHaveBeenCalled();
  });

  it("still tells the user when old names cannot be renamed", () => {
    const { root } = project(BARE_OLD);

    createConfigMigration({ root, env: { CI: "true" } }).run();

    expect(showWarningMessage).toHaveBeenCalledTimes(1);
  });
});

describe("the views when the migration fails", () => {
  it("still load", async () => {
    const fake = fakeClient([record("demo")]);
    const context = { subscriptions: [], extensionUri: vscode.Uri.file("/ext") } as unknown as vscode.ExtensionContext;

    const view = registerVariantsView(context, {
      root: "/work/vw",
      loadClient: async () => fake.client,
      hasConfig: () => true,
      migrate: () => {
        throw new Error("rewrite failed");
      },
    });
    await view.store.start();

    expect(view.store.records().map((entry) => entry.slug)).toEqual(["main", "demo"]);
  });

  it("run the migration once at registration", async () => {
    const fake = fakeClient([]);
    const context = { subscriptions: [], extensionUri: vscode.Uri.file("/ext") } as unknown as vscode.ExtensionContext;
    let calls = 0;

    registerVariantsView(context, {
      root: "/work/vw",
      loadClient: async () => fake.client,
      hasConfig: () => true,
      migrate: () => {
        calls += 1;
      },
    });

    expect(calls).toBe(1);
  });
});
