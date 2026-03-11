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

function generateReport(resultsPath, outputPath) {
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const { threshold, date, entries } = results;

  let passCount = 0;
  const totalCount = entries.length;

  const rows = entries.map(entry => {
    const passed = entry.matchPercent >= threshold;
    if (passed) passCount++;
    const statusClass = passed ? 'pass' : 'fail';
    const statusText = passed ? 'PASS' : 'FAIL';

    const toBase64 = (imgPath) => {
      if (!fs.existsSync(imgPath)) return '';
      return 'data:image/png;base64,' + fs.readFileSync(imgPath).toString('base64');
    };

    return `
      <div class="card ${statusClass}">
        <h3>${entry.name} — ${entry.route} (${entry.breakpoint})</h3>
        <p><a href="${entry.figmaUrl}" target="_blank">Figma Link</a></p>
        <div class="images">
          <div><p>Rendered</p><img src="${toBase64(entry.renderedImage)}" /></div>
          <div><p>Figma</p><img src="${toBase64(entry.figmaImage)}" /></div>
          <div><p>Diff</p><img src="${toBase64(entry.diffImage)}" /></div>
        </div>
        <p class="score ${statusClass}">${entry.matchPercent}% — ${statusText}</p>
      </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Match Figma Report — ${date}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
  .summary { font-size: 1.2em; margin: 20px 0; padding: 15px; background: white; border-radius: 8px; }
  .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ccc; }
  .card.pass { border-left-color: #22c55e; }
  .card.fail { border-left-color: #ef4444; }
  .images { display: flex; gap: 10px; margin: 10px 0; }
  .images div { flex: 1; text-align: center; }
  .images img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  .score { font-size: 1.3em; font-weight: bold; }
  .score.pass { color: #22c55e; }
  .score.fail { color: #ef4444; }
  .footer { margin-top: 30px; color: #666; font-size: 0.9em; }
</style></head><body>
  <h1>Match Figma Report — ${date}</h1>
  <div class="summary">
    <strong>Overall: ${passCount === totalCount ? 'PASS' : 'FAIL'}</strong> — ${passCount}/${totalCount} passed (threshold: ${threshold}%)
  </div>
  ${rows}
  <div class="footer">Threshold: ${threshold}% | Pages tested: ${totalCount}</div>
</body></html>`;

  fs.writeFileSync(outputPath, html);
  console.log(JSON.stringify({ report: path.resolve(outputPath) }));
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.report) {
    generateReport(args.report, args.output);
    return;
  }

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
