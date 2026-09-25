import { readFile, writeFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = new URL('../', import.meta.url);
const monogram = await readFile(new URL('src/ui/ait-monogram.svg', root), 'utf8');
const paths = monogram.match(/<path\b[^>]*\/>/g)?.join('\n');
if (!paths) throw new Error('Missing AiT vector paths');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 30 30"><title>AiT</title><defs><linearGradient id="ait-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6850ef"/><stop offset="1" stop-color="#405be0"/></linearGradient></defs><circle cx="15" cy="15" r="15" fill="url(#ait-gradient)"/>${paths}</svg>`;
await writeFile(new URL('public/icons/ait.svg', root), svg + '\n');
const image = await loadImage(Buffer.from(svg));
for (const size of [16, 32, 48, 128]) {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(image, 0, 0, size, size);
  await writeFile(new URL(`public/icons/${size}.png`, root), canvas.toBuffer('image/png'));
}
console.log('Generated AiT icons: 16, 32, 48, 128px and SVG');
