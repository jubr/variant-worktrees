import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

/** The declarations of the first rule with this selector inside `scope`. */
const declarations = (scope: string, selector: string): Record<string, string> => {
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(scope);
  return Object.fromEntries(
    (match?.[1] ?? "")
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as const;
      }),
  );
};

const darkScope = /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const lightScope = css.replace(darkScope, "");

/** `var(--vscode-x, #abc123)` or `#abc123` as the colour that applies when the editor provides no theme. */
const fallbackColour = (value: string | undefined): string => /#[0-9a-fA-F]{6}/.exec(value ?? "")?.[0] ?? "";

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

describe("styles", () => {
  it("takes the palette from the editor theme variables", () => {
    const light = declarations(lightScope, ":root");

    expect(light["--vv-bg"]).toContain("var(--vscode-editor-background");
    expect(light["--vv-fg"]).toContain("var(--vscode-foreground");
  });

  it("switches to a dark fallback palette when the browser prefers a dark scheme", () => {
    const light = declarations(lightScope, ":root");
    const dark = declarations(darkScope, ":root");

    expect(darkScope).not.toBe("");
    expect(fallbackColour(dark["--vv-bg"])).not.toBe("");
    expect(fallbackColour(dark["--vv-bg"])).not.toBe(fallbackColour(light["--vv-bg"]));
    expect(luminance(fallbackColour(dark["--vv-bg"]))).toBeLessThan(luminance(fallbackColour(light["--vv-bg"])));
  });

  it("keeps text readable in both fallback palettes", () => {
    for (const scope of [lightScope, darkScope]) {
      const palette = declarations(scope, ":root");
      for (const text of ["--vv-fg", "--vv-muted", "--vv-error"]) {
        expect(contrast(fallbackColour(palette[text]), fallbackColour(palette["--vv-bg"]))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("paints a watching dot green and mutes a dirty implode by disabling it", () => {
    expect(declarations(css, ":root")["--vv-green"]).toBe("var(--vscode-charts-green, #1a7f37)");
    expect(declarations(css, ".state-watching").color).toBe("var(--vv-green)");
    expect(declarations(css, ".implode-clean").color).toBe("var(--vv-fg)");
    expect(declarations(css, ".implode-dirty").color).toBe("currentColor");
    expect(declarations(css, ".icon-button:disabled").opacity).toBe("0.4");
    expect(declarations(css, ".implode-clean")["margin-left"]).toBe("auto");
    expect(declarations(css, ".implode-dirty")["margin-left"]).toBe("auto");
  });

  it("never hides the state label, so colour is not the only state signal", () => {
    for (const selector of [".state", ".state-watching", ".state-up", ".state-down"]) {
      const rule = declarations(css, selector);
      expect(rule.display).not.toBe("none");
      expect(rule.visibility).not.toBe("hidden");
      expect(rule["font-size"]).not.toBe("0");
    }
  });
});
