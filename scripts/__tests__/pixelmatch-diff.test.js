const { execSync } = require('child_process');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'pixelmatch-diff.js');
const TMP = path.join(__dirname, '..', '__test_tmp__');

beforeAll(async () => {
  fs.mkdirSync(TMP, { recursive: true });

  // Create a 10x10 red PNG
  const red = Buffer.alloc(10 * 10 * 4, 0);
  for (let i = 0; i < 10 * 10; i++) {
    red[i * 4] = 255;
    red[i * 4 + 1] = 0;
    red[i * 4 + 2] = 0;
    red[i * 4 + 3] = 255;
  }
  await sharp(red, { raw: { width: 10, height: 10, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'red.png'));

  // Create a 10x10 blue PNG
  const blue = Buffer.alloc(10 * 10 * 4, 0);
  for (let i = 0; i < 10 * 10; i++) {
    blue[i * 4] = 0;
    blue[i * 4 + 1] = 0;
    blue[i * 4 + 2] = 255;
    blue[i * 4 + 3] = 255;
  }
  await sharp(blue, { raw: { width: 10, height: 10, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'blue.png'));
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('identical images return 100% match', () => {
  const result = execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/red.png --output ${TMP}/diff_identical.png`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(result);
  expect(json.matchPercent).toBe(100);
  expect(json.mismatchPixels).toBe(0);
  expect(json.totalPixels).toBe(100);
  expect(fs.existsSync(json.diffImage)).toBe(true);
});

test('completely different images return low match', () => {
  const result = execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/blue.png --output ${TMP}/diff_different.png`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(result);
  expect(json.matchPercent).toBeLessThan(10);
  expect(json.mismatchPixels).toBeGreaterThan(90);
});

test('sensitivity flag affects results', () => {
  const lenient = JSON.parse(execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/blue.png --output ${TMP}/diff_lenient.png --sensitivity 1.0`,
    { encoding: 'utf8' }
  ));
  const strict = JSON.parse(execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/blue.png --output ${TMP}/diff_strict.png --sensitivity 0.01`,
    { encoding: 'utf8' }
  ));
  expect(lenient.mismatchPixels).toBeLessThanOrEqual(strict.mismatchPixels);
});

test('auto-resizes images with different dimensions', async () => {
  const green = Buffer.alloc(20 * 20 * 4, 0);
  for (let i = 0; i < 20 * 20; i++) {
    green[i * 4] = 0;
    green[i * 4 + 1] = 255;
    green[i * 4 + 2] = 0;
    green[i * 4 + 3] = 255;
  }
  await sharp(green, { raw: { width: 20, height: 20, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'green_20x20.png'));

  const result = execSync(
    `node ${SCRIPT} --img1 ${TMP}/red.png --img2 ${TMP}/green_20x20.png --output ${TMP}/diff_resize.png`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(result);
  expect(json.matchPercent).toBeDefined();
  expect(json.totalPixels).toBe(400); // 20x20
  expect(fs.existsSync(json.diffImage)).toBe(true);
});
