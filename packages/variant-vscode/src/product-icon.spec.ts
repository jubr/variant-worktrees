import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import docsConfig from "../../../docs/.vitepress/config.ts";

/**
 * Specification: openspec/specs/variant-vscode/product-icon/spec.md
 */

const repoRoot = join(import.meta.dirname, "../../..");

const published = [
  { file: "packages/variant-vscode/media/icon-256.png", size: 256 },
  { file: "packages/variant-vscode/media/icon-128.png", size: 128 },
  { file: "docs/public/logo-256.png", size: 256 },
  { file: "docs/public/favicon-32.png", size: 32 },
  { file: "docs/public/favicon-16.png", size: 16 },
] as const;

/** Inside / outside a rounded rect flush to the icon. Corner radius is 1/10 of the side. */
const region = (x: number, y: number, size: number): "in" | "out" | "edge" => {
  const radius = size / 10;
  const half = size / 2;
  const px = x + 0.5 - half;
  const py = y + 0.5 - half;
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  const distance = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  if (distance < -1) {
    return "in";
  }
  if (distance > 1) {
    return "out";
  }
  return "edge";
};

const scaledArtwork = async (size: number): Promise<Buffer> => {
  const source = readFileSync(join(repoRoot, "assets/brand/variant-worktrees.png"));
  const meta = await sharp(source).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const crop = Math.min(width, height);
  const left = Math.floor((width - crop) / 2);
  const top = Math.floor((height - crop) / 2);
  return sharp(source)
    .extract({ left, top, width: crop, height: crop })
    .resize(size, size, { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer();
};

const decoded = async (file: string) => {
  const png = readFileSync(join(repoRoot, file));
  return sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
};

describe("product icon", () => {
  it("points the extension manifest at the 256 icon and whitelists it for the vsix", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "packages/variant-vscode/package.json"), "utf8")) as {
      icon?: string;
    };
    const ignore = readFileSync(join(repoRoot, "packages/variant-vscode/.vscodeignore"), "utf8");
    expect(manifest.icon).toBe("media/icon-256.png");
    expect(ignore).toContain("!media/icon-256.png");
  });

  it("uses the 256 icon as the docs logo and the small icons as favicons", () => {
    const head = docsConfig.head ?? [];
    expect(docsConfig.themeConfig.logo).toBe("/logo-256.png");
    expect(head).toContainEqual(["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" }]);
    expect(head).toContainEqual(["link", { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" }]);
  });

  it("shows the 256 icon in the repository README", () => {
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    expect(readme).toContain("packages/variant-vscode/media/icon-256.png");
  });

  it("packs the 256 icon into the vsix", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "packages/variant-vscode/package.json"), "utf8")) as {
      version: string;
    };
    const packed = spawnSync("bun", ["run", "package"], {
      cwd: join(repoRoot, "packages/variant-vscode"),
      encoding: "utf8",
    });
    expect(packed.status, packed.stderr || packed.stdout).toBe(0);
    const vsix = join(repoRoot, "out", `variant-worktrees-${manifest.version}.vsix`);
    const listed = spawnSync("unzip", ["-l", vsix], { encoding: "utf8" });
    expect(listed.stdout).toContain("media/icon-256.png");
  });

  it("publishes rounded-rectangle downscales with transparent corners", async () => {
    const icon256 = await decoded("packages/variant-vscode/media/icon-256.png");
    const logo256 = await decoded("docs/public/logo-256.png");
    expect(Buffer.compare(icon256.data, logo256.data)).toBe(0);

    for (const { file, size } of published) {
      const { data, info } = await decoded(file);
      expect(info.width).toBe(size);
      expect(info.height).toBe(size);

      const artwork = await scaledArtwork(size);

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4;
          const where = region(x, y, size);
          if (where === "out") {
            expect(data[offset + 3]).toBe(0);
          }
          if (where === "in") {
            expect(data[offset]).toBe(artwork[offset]);
            expect(data[offset + 1]).toBe(artwork[offset + 1]);
            expect(data[offset + 2]).toBe(artwork[offset + 2]);
            expect(data[offset + 3]).toBe(255);
          }
        }
      }
    }
  });
});
