/**
 * Composites the real engine-rendered posters into the AI-generated lifestyle
 * scenes (scripts/scenes/*-raw.png, prompts in scripts/scenes/PROMPTS.md).
 *
 * Each scene was generated with the area inside its picture frame as solid
 * pure black. This script finds that black rectangle automatically, cover-fits
 * the poster PNG into it, seats it with a subtle inner shadow, and writes the
 * palette-quantised result to public/showcase/. The hero scene also yields the
 * 1200x630 OpenGraph card.
 *
 *   pnpm --filter @pinprint/frontend render:scenes
 *
 * Run AFTER `render:posters` (it consumes public/showcase/<poster>.png).
 * On-demand asset generation — NOT part of `next build` or CI.
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FRONTEND_DIR = process.cwd();
const SCENES_DIR = path.resolve(FRONTEND_DIR, "scripts/scenes");
const OUT_DIR = path.resolve(FRONTEND_DIR, "public/showcase");

type Composite = {
  out: string;
  scene: string;
  /** Poster slug under public/showcase, or null for scenes used as-is. */
  poster: string | null;
};

const SCENES: Composite[] = [
  { out: "scene-hero", scene: "scene-hero-raw.png", poster: "hero-poster" },
  { out: "scene-gift", scene: "scene-gift-raw.png", poster: "story-the-honeymoon" },
  { out: "scene-craft", scene: "scene-craft-raw.png", poster: null },
];

/**
 * Bounding box of the frame's solid-black poster area. Scenes also contain
 * scattered dark pixels (shadows, book spines), so a plain black-pixel bbox
 * overshoots badly. Instead a pixel only counts when it sits inside a long
 * solid black run BOTH horizontally and vertically — true only inside a large
 * filled rectangle.
 */
async function findBlackRect(img: sharp.Sharp) {
  const { data, info } = await img
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const THRESH = 40;
  const isBlack = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return data[i] < THRESH && data[i + 1] < THRESH && data[i + 2] < THRESH;
  };

  const minRunX = Math.round(width * 0.1);
  const minRunY = Math.round(height * 0.1);

  // Mark pixels inside horizontal runs >= minRunX.
  const hMark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const black = x < width && isBlack(x, y);
      if (black && runStart < 0) runStart = x;
      if (!black && runStart >= 0) {
        if (x - runStart >= minRunX) hMark.fill(1, y * width + runStart, y * width + x);
        runStart = -1;
      }
    }
  }
  // Intersect with vertical runs >= minRunY.
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y <= height; y++) {
      const solid = y < height && hMark[y * width + x] === 1;
      if (solid && runStart < 0) runStart = y;
      if (!solid && runStart >= 0) {
        if (y - runStart >= minRunY) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (runStart < minY) minY = runStart;
          if (y - 1 > maxY) maxY = y - 1;
        }
        runStart = -1;
      }
    }
  }
  if (maxX < 0) throw new Error("no solid black rectangle found in scene");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Subtle inner shadow so the print sits inside the frame instead of on it. */
function innerShadowSvg(w: number, h: number): Buffer {
  const inset = Math.max(3, Math.round(Math.min(w, h) * 0.012));
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="b" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="${inset}" />
        </filter>
      </defs>
      <rect x="${-inset}" y="${-inset}" width="${w + 2 * inset}" height="${h + 2 * inset}"
        rx="1" fill="none" stroke="#1f1409" stroke-width="${inset * 2.5}"
        stroke-opacity="0.55" filter="url(#b)" />
    </svg>`,
  );
}

async function composeOne({ out, scene, poster }: Composite) {
  const scenePath = path.join(SCENES_DIR, scene);
  const base = sharp(await readFile(scenePath));

  let composed: sharp.Sharp;
  if (poster) {
    const rect = await findBlackRect(base);
    const posterBuf = await sharp(path.join(OUT_DIR, `${poster}.png`))
      .resize(rect.width, rect.height, { fit: "cover", position: "centre" })
      .toBuffer();
    composed = base.composite([
      { input: posterBuf, left: rect.left, top: rect.top },
      {
        input: await sharp(innerShadowSvg(rect.width, rect.height)).png().toBuffer(),
        left: rect.left,
        top: rect.top,
      },
    ]);
  } else {
    composed = base;
  }

  const png = await composed
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT_DIR, `${out}.png`), png);
  console.log(`${out}.png (${(png.length / 1024).toFixed(0)} KB)`);
  return png;
}

/** 1200x630 OG card: cover-crop of the finished hero scene. */
async function ogCard(heroPng: Buffer) {
  const png = await sharp(heroPng)
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT_DIR, "og-card.png"), png);
  console.log(`og-card.png (${(png.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  let hero: Buffer | undefined;
  for (const c of SCENES) {
    const png = await composeOne(c);
    if (c.out === "scene-hero") hero = png;
  }
  if (hero) await ogCard(hero);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
