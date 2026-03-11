#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const sharp = require('sharp');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

async function loadAndResize(filePath, targetWidth, targetHeight) {
  const resized = await sharp(filePath)
    .resize(targetWidth, targetHeight, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return resized;
}

async function main() {
  const args = parseArgs(process.argv);
  const img1Path = args.img1;
  const img2Path = args.img2;
  const outputPath = args.output;
  const sensitivity = parseFloat(args.sensitivity || '0.1');

  if (!img1Path || !img2Path || !outputPath) {
    console.error('Usage: pixelmatch-diff.js --img1 <path> --img2 <path> --output <path> [--sensitivity <0-1>]');
    process.exit(1);
  }

  const meta1 = await sharp(img1Path).metadata();
  const meta2 = await sharp(img2Path).metadata();

  const width = Math.max(meta1.width, meta2.width);
  const height = Math.max(meta1.height, meta2.height);

  const buf1 = await loadAndResize(img1Path, width, height);
  const buf2 = await loadAndResize(img2Path, width, height);

  const totalPixels = width * height;
  const diffBuf = Buffer.alloc(totalPixels * 4);

  const mismatchPixels = pixelmatch(
    buf1.data, buf2.data, diffBuf,
    width, height,
    { threshold: sensitivity }
  );

  const diffPng = new PNG({ width, height });
  diffPng.data = diffBuf;
  const diffStream = fs.createWriteStream(outputPath);
  diffPng.pack().pipe(diffStream);

  await new Promise((resolve, reject) => {
    diffStream.on('finish', resolve);
    diffStream.on('error', reject);
  });

  const matchPercent = parseFloat(((1 - mismatchPixels / totalPixels) * 100).toFixed(1));

  const result = {
    matchPercent,
    mismatchPixels,
    totalPixels,
    diffImage: path.resolve(outputPath)
  };

  console.log(JSON.stringify(result));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
