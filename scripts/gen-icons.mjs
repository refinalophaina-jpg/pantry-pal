#!/usr/bin/env node
/**
 * Regenerate PWA / app icons from the AinaDara icon source (terracotta basket).
 * Uses sharp (already a dependency). Run after changing icon-source.svg:
 *
 *   node scripts/gen-icons.mjs
 *
 * Outputs PNGs into public/icons. For native desktop icons, feed the 1024 PNG
 * to Tauri: `npx tauri icon public/icons/icon-1024.png`.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "public/icons/icon-source.svg"));

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-1024.png", 1024],
  ["public/icons/apple-touch-icon.png", 180],
];

for (const [out, size] of targets) {
  await sharp(src, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(root, out));
  console.log(`✓ ${out} (${size}px)`);
}

// Maskable icon for Android adaptive icons: the mark sits inside the 80% safe zone
// on the AinaDara paper colour, so launchers that crop to a circle or squircle never
// clip it. Declared in public/manifest.webmanifest with purpose "maskable".
const maskableSize = 512;
const inner = Math.round(maskableSize * 0.8);
const mark = await sharp(src, { density: 384 }).resize(inner, inner).png().toBuffer();
await sharp({ create: { width: maskableSize, height: maskableSize, channels: 4, background: "#faf5ed" } })
  .composite([{ input: mark, gravity: "centre" }])
  .png()
  .toFile(join(root, "public/icons/icon-maskable-512.png"));
console.log(`✓ public/icons/icon-maskable-512.png (${maskableSize}px, maskable)`);
console.log("Done. For desktop: npx tauri icon public/icons/icon-1024.png");
