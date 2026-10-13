import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const repoRoot = join(import.meta.dirname, "../..");
const source = readFileSync(join(repoRoot, "assets/brand/source.png"));

const render = async (size: number): Promise<Buffer> => {
  const meta = await sharp(source).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const crop = Math.min(width, height);
  const left = Math.floor((width - crop) / 2);
  const top = Math.floor((height - crop) / 2);
  const radius = size / 10;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/></svg>`,
  );
  return sharp(source)
    .extract({ left, top, width: crop, height: crop })
    .resize(size, size, { kernel: "lanczos3" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
};

const outputs: Array<{ file: string; size: number }> = [
  { file: "packages/variant-vscode/media/icon-256.png", size: 256 },
  { file: "packages/variant-vscode/media/icon-128.png", size: 128 },
  { file: "docs/public/logo-256.png", size: 256 },
  { file: "docs/public/favicon-32.png", size: 32 },
  { file: "docs/public/favicon-16.png", size: 16 },
];

const rendered = new Map<number, Buffer>();
for (const { file, size } of outputs) {
  const png = rendered.get(size) ?? (await render(size));
  rendered.set(size, png);
  const target = join(repoRoot, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);
}
