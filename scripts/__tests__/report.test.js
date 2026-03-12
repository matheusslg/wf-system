const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SCRIPT = path.join(__dirname, '..', 'pixelmatch-diff.js');
const TMP = path.join(__dirname, '..', '__test_tmp_report__');

beforeAll(async () => {
  fs.mkdirSync(TMP, { recursive: true });

  const px = Buffer.alloc(4 * 4, 0);
  for (let i = 0; i < 4; i++) { px[i * 4] = 255; px[i * 4 + 3] = 255; }
  await sharp(px, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'a.png'));
  await sharp(px, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'b.png'));
  await sharp(px, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(path.join(TMP, 'diff.png'));
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('generates HTML report from results JSON', () => {
  const results = {
    threshold: 80,
    date: '2026-03-11',
    entries: [
      {
        name: 'Dashboard',
        route: '/dashboard',
        breakpoint: 'desktop',
        figmaUrl: 'https://www.figma.com/design/abc/App?node-id=1-2',
        matchPercent: 94.2,
        renderedImage: path.join(TMP, 'a.png'),
        figmaImage: path.join(TMP, 'b.png'),
        diffImage: path.join(TMP, 'diff.png')
      },
      {
        name: 'Login',
        route: '/login',
        breakpoint: 'desktop',
        figmaUrl: 'https://www.figma.com/design/abc/App?node-id=3-4',
        matchPercent: 72.1,
        renderedImage: path.join(TMP, 'a.png'),
        figmaImage: path.join(TMP, 'b.png'),
        diffImage: path.join(TMP, 'diff.png')
      }
    ]
  };

  const resultsPath = path.join(TMP, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results));

  const reportPath = path.join(TMP, 'report.html');
  const stdout = execSync(`node ${SCRIPT} --report ${resultsPath} --output ${reportPath}`, { encoding: 'utf8' });
  const out = JSON.parse(stdout);
  expect(out.report).toContain('report.html');

  expect(fs.existsSync(reportPath)).toBe(true);

  const html = fs.readFileSync(reportPath, 'utf8');
  expect(html).toContain('Match Figma Report');
  expect(html).toContain('Dashboard');
  expect(html).toContain('94.2%');
  expect(html).toContain('72.1%');
  expect(html).toContain('PASS');
  expect(html).toContain('FAIL');
  expect(html).toContain('data:image/png;base64,');
  expect(html).toContain('1/2 passed');
});
