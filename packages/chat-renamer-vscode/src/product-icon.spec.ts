import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/**
 * Specification: openspec/specs/chat-renamer-vscode/product-icon/spec.md
 */

const repoRoot = join(import.meta.dirname, "../../..");

const published = [
  { file: "packages/chat-renamer-vscode/media/icon-256.png", size: 256 },
  { file: "packages/chat-renamer-vscode/media/icon-128.png", size: 128 },
] as const;

const scaledArtwork = async (size: number): Promise<Buffer> => {
  const source = readFileSync(join(repoRoot, "assets/brand/chat-renamer.png"));
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
  it("points the extension manifest at the 256 icon and whitelists both sizes", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "packages/chat-renamer-vscode/package.json"), "utf8")) as {
      icon?: string;
    };
    const ignore = readFileSync(join(repoRoot, "packages/chat-renamer-vscode/.vscodeignore"), "utf8");
    expect(manifest.icon).toBe("media/icon-256.png");
    expect(ignore).toContain("!media/icon-256.png");
    expect(ignore).toContain("!media/icon-128.png");
  });

  it("shows the 128 icon in the package README", () => {
    const readme = readFileSync(join(repoRoot, "packages/chat-renamer-vscode/README.md"), "utf8");
    expect(readme).toContain("media/icon-128.png");
    expect(readme).not.toContain("media/icon-256.png");
  });

  it("packs both icons into the vsix", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "packages/chat-renamer-vscode/package.json"), "utf8")) as {
      version: string;
    };
    const packed = spawnSync("bun", ["run", "package"], {
      cwd: join(repoRoot, "packages/chat-renamer-vscode"),
      encoding: "utf8",
    });
    expect(packed.status, packed.stderr || packed.stdout).toBe(0);
    const vsix = join(repoRoot, "out", `chat-renamer-${manifest.version}.vsix`);
    const listed = spawnSync("unzip", ["-l", vsix], { encoding: "utf8" });
    expect(listed.stdout).toContain("media/icon-256.png");
    expect(listed.stdout).toContain("media/icon-128.png");
  });

  it("publishes unmasked square scales of the source artwork", async () => {
    for (const { file, size } of published) {
      const { data, info } = await decoded(file);
      expect(info.width).toBe(size);
      expect(info.height).toBe(size);
      const artwork = await scaledArtwork(size);
      expect(Buffer.compare(data, artwork)).toBe(0);
    }
  });
});
