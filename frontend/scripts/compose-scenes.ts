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
import sharp, { type Sharp } from "sharp";
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
  /**
   * Optional integer upscale applied to the scene BEFORE compositing. The
   * generator caps out around 1.5K wide; for full-bleed uses we lanczos the
   * scene up and then composite the native-resolution poster render, so the
   * artwork (the part eyes land on) stays pixel-crisp.
   */
  upscale?: number;
  /**
   * Optional fraction (of height) to shift the whole scene DOWN: the top edge
   * is extended with a mirrored, blurred strip of wall and the same amount is
   * cropped off the bottom, so dimensions stay identical. Used to seat the
   * framed poster on the page's visual midline; `object-position` can't do
   * this because the full-bleed hero has no vertical crop slack.
   */
  shiftDown?: number;
};

const SCENES: Composite[] = [
  { out: "scene-hero", scene: "scene-hero-raw.png", poster: "hero-poster" },
  {
    out: "scene-hero-wide",
    scene: "scene-hero-wide-raw.png",
    poster: "hero-poster",
    upscale: 2,
    shiftDown: 0.06,
  },
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
async function findBlackRect(img: Sharp) {
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

async function composeOne({ out, scene, poster, upscale, shiftDown }: Composite) {
  const scenePath = path.join(SCENES_DIR, scene);
  let sceneBuf: Buffer = await readFile(scenePath);
  if (upscale && upscale > 1) {
    const meta = await sharp(sceneBuf).metadata();
    sceneBuf = await sharp(sceneBuf)
      .resize((meta.width ?? 0) * upscale, (meta.height ?? 0) * upscale, {
        kernel: "lanczos3",
      })
      .sharpen({ sigma: 0.8 })
      .toBuffer();
  }
  if (shiftDown && shiftDown > 0) {
    const meta = await sharp(sceneBuf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const pad = Math.round(h * shiftDown);
    // Mirrored strip of the top rows, flipped and softened, becomes the new
    // ceiling-side wall; the same height comes off the bottom.
    const topStrip = await sharp(sceneBuf)
      .extract({ left: 0, top: 0, width: w, height: pad })
      .flip()
      .blur(6)
      .toBuffer();
    const body = await sharp(sceneBuf)
      .extract({ left: 0, top: 0, width: w, height: h - pad })
      .toBuffer();
    sceneBuf = await sharp({
      create: { width: w, height: h, channels: 3, background: "#f0ead9" },
    })
      .composite([
        { input: topStrip, left: 0, top: 0 },
        { input: body, left: 0, top: pad },
      ])
      .png()
      .toBuffer();
  }
  const base = sharp(sceneBuf);

  let composed: Sharp;
  if (poster) {
    const rect = await findBlackRect(base);
    // Posters are 2:3 but the AI frames only approximate it. Near-ratio frames
    // get a stretch-to-fill (imperceptible under ~6%); wider frames get a
    // contain-fit padded with the poster's own paper color, which reads as the
    // artwork's margin rather than a crop that beheads the title block.
    const posterPath = path.join(OUT_DIR, `${poster}.png`);
    const target = 2 / 3;
    const actual = rect.width / rect.height;
    const nearRatio = Math.abs(actual - target) / target < 0.06;
    let posterBuf: Buffer;
    if (nearRatio) {
      posterBuf = await sharp(posterPath)
        .resize(rect.width, rect.height, { fit: "fill" })
        .toBuffer();
    } else {
      const { data } = await sharp(posterPath)
        .extract({ left: 4, top: 4, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const paper = { r: data[0], g: data[1], b: data[2], alpha: 1 };
      posterBuf = await sharp(posterPath)
        .resize(rect.width, rect.height, { fit: "contain", background: paper })
        .toBuffer();
    }
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
