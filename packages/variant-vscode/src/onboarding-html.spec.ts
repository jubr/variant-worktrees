import { describe, expect, it } from "bun:test";
import { buildOnboardingHtml, prefixProblem } from "./onboarding-html.ts";

/** Specification: onboarding (Onboarding command and dialog) */

const page = (hasConfig = false) =>
  buildOnboardingHtml({
    nonce: "N0NCE",
    cspSource: "vscode-webview-resource:",
    iconUri: "vscode-resource:/media/icon-128.png",
    hasConfig,
  });

describe("buildOnboardingHtml", () => {
  it("allows scripts and styles only with the nonce and loads nothing from outside", () => {
    const html = page();
    const policy = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'nonce-N0NCE'");
    expect(policy).toContain("style-src 'nonce-N0NCE'");
    expect(policy).toContain("img-src vscode-webview-resource:");
    expect(policy).not.toMatch(/https?:/);
    expect(html).not.toMatch(/<script(?![^>]*nonce="N0NCE")/);
    expect(html).not.toMatch(/<style(?![^>]*nonce="N0NCE")/);
    expect(html).not.toMatch(/\s(?:src|href)="https?:/);
  });

  it("shows the intro, the icon, the prefix, three checked checkboxes and the buttons", () => {
    const html = page();

    expect(html).toContain("Initialize Variant");
    expect(html).toContain('<img class="icon" src="vscode-resource:/media/icon-128.png"');
    expect(html).toMatch(/<input id="prefix" type="text" value="_v-"/);
    expect(html).toContain("Write variants.yaml with autodetected values");
    expect(html).toContain('Add <span id="pattern">_v-*</span> to .gitignore');
    expect(html).toContain("Augment mise.toml with variant-cli");
    expect(html.match(/type="checkbox"[^>]* checked/g)).toHaveLength(3);
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain(">Initialize</button>");
    expect(html).not.toContain(">Init</button>");
  });

  it("keeps Prefix inside a collapsed Advanced disclosure immediately above the buttons", () => {
    const html = page();
    const details = html.indexOf("<details>");
    const summary = html.indexOf("<summary>Advanced</summary>");
    const prefix = html.indexOf('id="prefix"');
    const problem = html.indexOf('id="problem"');
    const buttons = html.indexOf('class="buttons"');

    expect(html).not.toContain("<details open");
    expect(summary).toBeGreaterThan(details);
    expect(prefix).toBeGreaterThan(summary);
    expect(html.indexOf("</details>")).toBeGreaterThan(prefix);
    expect(html.indexOf("</details>")).toBeLessThan(buttons);
    expect(problem).toBeGreaterThan(-1);
    expect(problem).toBeLessThan(details);
  });

  it("puts the icon at the top right of a narrow single column", () => {
    const html = page();

    expect(html).toMatch(/header \{[^}]*justify-content: space-between/);
    expect(html).toMatch(/main \{[^}]*flex-direction: column/);
    expect(html).toMatch(/\.icon \{[^}]*width: 20px/);
  });

  it("uses the editor theme variables for its colors", () => {
    expect(page()).toContain("var(--vscode-foreground)");
    expect(page()).toContain("var(--vscode-button-background)");
  });

  it("unchecks and disables the first checkbox when a variants.yaml exists, and says why", () => {
    const html = page(true);

    expect(html).toMatch(/<input id="file" type="checkbox" disabled \/>/);
    expect(html.match(/type="checkbox"[^>]* checked/g)).toHaveLength(2);
    expect(html).toContain("already has a variants.yaml");
    expect(html).not.toMatch(/id="file-note"[^>]*hidden/);
  });

  it("hides the note about an existing variants.yaml otherwise", () => {
    expect(page()).toMatch(/id="file-note"[^>]*hidden/);
  });

  it("has the messages of the dialog in its script", () => {
    const html = page();

    for (const type of ["cancel", "init", "trust", "failed", "config"]) {
      expect(html).toContain(`"${type}"`);
    }
  });
});

describe("prefixProblem", () => {
  it("accepts a prefix with a connector", () => {
    expect(prefixProblem("_v-")).toBeUndefined();
    expect(prefixProblem("wt-")).toBeUndefined();
  });

  it("rejects an empty prefix and a path separator, giving the reason", () => {
    expect(prefixProblem("")).toMatch(/empty/);
    expect(prefixProblem("a/b")).toMatch(/path separator/);
    expect(prefixProblem("a\\b")).toMatch(/path separator/);
  });
});

describe("the page script", () => {
  const script = (): string => /<script nonce="N0NCE">([\s\S]*)<\/script>/.exec(page())?.[1] ?? "";

  it("is valid JavaScript", () => {
    expect(() => new Function(script())).not.toThrow();
  });

  it("applies the same prefix rule as the host", () => {
    const rule = /const problemOf = \(value\) => \{[\s\S]*?\n {2}\};/.exec(script())?.[0] ?? "";
    const problemOf = new Function(`${rule}\nreturn problemOf;`)() as (value: string) => string | undefined;

    for (const value of ["", "_v-", "a/b", "a\\b", "wt-"]) {
      expect(problemOf(value)).toBe(prefixProblem(value));
    }
  });
});
