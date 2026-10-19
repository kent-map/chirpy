#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const DEFAULT_MAX_DIMENSION = 2400;
const DEFAULT_JPEG_QUALITY = 82;
const DEFAULT_CONCURRENCY = 4;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

function positiveInteger(value, fallback, label) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer; received ${value}`);
  }
  return parsed;
}

const rootArgument = process.argv[2];
if (!rootArgument) {
  console.error("Usage: node tools/optimize_deployment_images.mjs <deployment-image-directory>");
  process.exit(2);
}

const root = path.resolve(rootArgument);
const maxDimension = positiveInteger(
  process.env.ENTRELUMA_IMAGE_MAX_DIMENSION,
  DEFAULT_MAX_DIMENSION,
  "ENTRELUMA_IMAGE_MAX_DIMENSION",
);
const jpegQuality = positiveInteger(
  process.env.ENTRELUMA_JPEG_QUALITY,
  DEFAULT_JPEG_QUALITY,
  "ENTRELUMA_JPEG_QUALITY",
);
const concurrency = positiveInteger(
  process.env.ENTRELUMA_IMAGE_CONCURRENCY,
  DEFAULT_CONCURRENCY,
  "ENTRELUMA_IMAGE_CONCURRENCY",
);

if (jpegQuality > 100) {
  throw new Error("ENTRELUMA_JPEG_QUALITY must not exceed 100");
}

async function collectImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectImages(target)));
    } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(target);
    }
  }
  return files;
}

async function optimizeImage(input) {
  const before = (await stat(input)).size;
  const extension = path.extname(input).toLowerCase();
  const temporary = `${input}.optimized-${randomUUID()}`;

  try {
    let pipeline = sharp(input, { failOn: "warning" })
      .autoOrient()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });

    if (extension === ".png") {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    } else {
      pipeline = pipeline.jpeg({
        quality: jpegQuality,
        progressive: true,
        mozjpeg: true,
      });
    }

    await pipeline.toFile(temporary);
    const after = (await stat(temporary)).size;
    if (after < before) {
      await rename(temporary, input);
      return { before, after, changed: true };
    }

    await unlink(temporary);
    return { before, after: before, changed: false };
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw new Error(`${path.relative(root, input)}: ${error.message}`, { cause: error });
  }
}

const images = await collectImages(root);
let nextIndex = 0;
let changed = 0;
let beforeBytes = 0;
let afterBytes = 0;

async function worker() {
  while (nextIndex < images.length) {
    const imageIndex = nextIndex;
    nextIndex += 1;
    const result = await optimizeImage(images[imageIndex]);
    beforeBytes += result.before;
    afterBytes += result.after;
    if (result.changed) changed += 1;
  }
}

await Promise.all(
  Array.from({ length: Math.min(concurrency, images.length || 1) }, () => worker()),
);

const savedBytes = beforeBytes - afterBytes;
console.log(
  `Optimized ${changed} of ${images.length} deployment images: ` +
    `${(beforeBytes / 1_000_000).toFixed(1)} MB -> ${(afterBytes / 1_000_000).toFixed(1)} MB ` +
    `(${(savedBytes / 1_000_000).toFixed(1)} MB saved).`,
);
