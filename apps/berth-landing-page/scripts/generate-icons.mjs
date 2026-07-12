import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const brandDir = resolve(here, '../../../brand');
const outDirs = [
  resolve(here, '../public'),
  resolve(here, '../../berth-ui/public'),
];

const appIcon = readFileSync(resolve(brandDir, 'app-icon.svg'));
const faviconSvg = readFileSync(resolve(brandDir, 'favicon.svg'));
const ogSvg = readFileSync(resolve(brandDir, 'og-image.svg'));

const PNG_SIZES = {
  'favicon-16.png': 16,
  'favicon-32.png': 32,
  'apple-touch-icon.png': 180,
  'icon-192.png': 192,
  'icon-512.png': 512,
};

async function render(svg, size) {
  return sharp(svg, { density: 600 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
}

for (const dir of outDirs) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'favicon.svg'), faviconSvg);

  for (const [name, size] of Object.entries(PNG_SIZES)) {
    writeFileSync(resolve(dir, name), await render(appIcon, size));
  }

  const ico = await pngToIco([
    await render(appIcon, 32),
    await render(appIcon, 16),
  ]);
  writeFileSync(resolve(dir, 'favicon.ico'), ico);

  const og = await sharp(ogSvg, { density: 96 })
    .resize(1200, 630)
    .png()
    .toBuffer();
  writeFileSync(resolve(dir, 'og-image.png'), og);

  console.log(`brand assets written to ${dir}`);
}
