import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const repoRoot = join(import.meta.dirname, "../..");
const variantSource = readFileSync(join(repoRoot, "assets/brand/variant-worktrees.png"));
const chatRenamerSource = readFileSync(join(repoRoot, "assets/brand/chat-renamer.png"));

const render = async (source: Buffer, size: number, mask: boolean): Promise<Buffer> => {
  const meta = await sharp(source).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const crop = Math.min(width, height);
  const left = Math.floor((width - crop) / 2);
  const top = Math.floor((height - crop) / 2);
  const image = sharp(source)
    .extract({ left, top, width: crop, height: crop })
    .resize(size, size, { kernel: "lanczos3" })
    .ensureAlpha();
  if (!mask) {
    return image.png().toBuffer();
  }
  const radius = size / 10;
  const rounded = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/></svg>`,
  );
  return image.composite([{ input: rounded, blend: "dest-in" }]).png().toBuffer();
};

const outputs: Array<{ source: Buffer; file: string; size: number; mask: boolean }> = [
  { source: variantSource, file: "packages/variant-vscode/media/icon-256.png", size: 256, mask: true },
  { source: variantSource, file: "packages/variant-vscode/media/icon-128.png", size: 128, mask: true },
  { source: variantSource, file: "docs/public/logo-256.png", size: 256, mask: true },
  { source: variantSource, file: "docs/public/favicon-32.png", size: 32, mask: true },
  { source: variantSource, file: "docs/public/favicon-16.png", size: 16, mask: true },
  {
    source: chatRenamerSource,
    file: "packages/chat-renamer-vscode/media/icon-256.png",
    size: 256,
    mask: false,
  },
  {
    source: chatRenamerSource,
    file: "packages/chat-renamer-vscode/media/icon-128.png",
    size: 128,
    mask: false,
  },
];

const rendered = new Map<string, Buffer>();
for (const { source, file, size, mask } of outputs) {
  const key = `${source === variantSource ? "variant" : "chat"}:${size}:${mask}`;
  const png = rendered.get(key) ?? (await render(source, size, mask));
  rendered.set(key, png);
  const target = join(repoRoot, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);
}
