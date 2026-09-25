import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AIT_MONOGRAM } from '../src/ui/monogram';

describe('shared AiT branding', () => {
  it.each(['popup', 'options', 'privacy', 'text-translate', 'document-translate'])('uses the AiT logo and favicon on %s', (page) => {
    const html = readFileSync(`entrypoints/${page}/index.html`, 'utf8');
    expect(html).toContain('class="brand-mark" src="/icons/128.png" alt="AiT"');
    expect(html).toContain('href="/icons/32.png"');
    expect(html).not.toContain('class="brand-mark">AI');
  });
  it('shares outlined artwork between the floating entry and exported icons', () => {
    const brand = readFileSync('public/icons/ait.svg', 'utf8');
    const paths = AIT_MONOGRAM.match(/<path\b[^>]*\/>/g)!;
    expect(paths).toHaveLength(3);
    paths.forEach((path) => expect(brand).toContain(path));
    expect(AIT_MONOGRAM).not.toContain('<text');
  });
  it.each([16, 32, 48, 128])('includes a %ipx PNG icon', (size) => {
    const png = readFileSync(`public/icons/${size}.png`);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });
});
