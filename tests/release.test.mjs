import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { packageRelease } from '../scripts/package-release.mjs';

let sandbox;
let projectRoot;
let release;
let version;
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 15_000, ...options });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr + result.stdout);
  return result.stdout;
}

beforeAll(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "aitran-release's test-"));
  projectRoot = join(sandbox, 'source');
  await mkdir(projectRoot);
  for (const file of ['package.json', 'package-lock.json', 'LICENSE', 'PRIVACY.md', 'CHANGELOG.md', 'distribution', 'docs']) {
    await cp(resolve(file), join(projectRoot, file), { recursive: true });
  }
  await mkdir(join(projectRoot, 'node_modules/pdfjs-dist'), { recursive: true });
  await copyFile(resolve('node_modules/pdfjs-dist/LICENSE'), join(projectRoot, 'node_modules/pdfjs-dist/LICENSE'));
  version = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')).version;
  for (const [browser, format] of [['chrome-mv3', 3], ['firefox-mv2', 2]]) {
    const root = join(projectRoot, '.output', browser);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ version, manifest_version: format, permissions: ['storage'] }));
    for (const page of ['popup', 'privacy']) await writeFile(join(root, `${page}.html`), `<p>v${version}</p>`);
  }
  release = await packageRelease({ projectRoot });
}, 30_000);
afterAll(async () => { if (sandbox) await rm(sandbox, { recursive: true, force: true }); });

describe('release packaging', () => {
  it('ships only browser packages with root manifests and verifiable checksums', async () => {
    expect(release.artifacts).toHaveLength(2);
    for (const artifact of release.artifacts) {
      const zip = join(release.directory, artifact.name);
      expect(createHash('sha256').update(await readFile(zip)).digest('hex')).toBe(artifact.sha256);
      const entries = run('unzip', ['-Z1', zip]).trim().split('\n');
      expect(entries.every((entry) => !/node_modules|\.git|\.local-codex|auth\.json|\.map$|^\//.test(entry))).toBe(true);
      expect(entries).toContain('manifest.json');
      expect(entries.some((entry) => /bridge|native-helper|codex/.test(entry))).toBe(false);
      const manifest = JSON.parse(run('unzip', ['-p', zip, 'manifest.json']));
      expect(manifest.version).toBe(version);
      expect(manifest.permissions).not.toContain('nativeMessaging');
    }
    expect(await readFile(join(release.directory, 'README.md'), 'utf8')).not.toContain('{{VERSION}}');
    expect(JSON.parse(await readFile(join(release.directory, 'release.json'), 'utf8'))).toMatchObject({ version, published: false, signed: false });
    await expect(packageRelease({ projectRoot })).rejects.toThrow('already exists');
  });

  it('rejects stale builds and unexpected files instead of packaging them', async () => {
    const root = join(projectRoot, '.output/chrome-mv3');
    const path = join(root, 'manifest.json');
    const original = await readFile(path, 'utf8');
    for (const permission of ['tabs', 'activeTab']) {
      const manifest = JSON.parse(original);
      manifest.permissions.push(permission);
      await writeFile(path, JSON.stringify(manifest));
      await expect(packageRelease({ projectRoot })).rejects.toThrow('Redundant permissions');
    }
    await writeFile(path, original.replace(version, '0.0.0'));
    await expect(packageRelease({ projectRoot })).rejects.toThrow('Stale');
    await writeFile(path, original);
    const background = join(root, 'background.js');
    await writeFile(background, 'const config = {apiKey:"dummy-test-key"}');
    await expect(packageRelease({ projectRoot })).rejects.toThrow('value redacted');
    await rm(background);
    await writeFile(join(root, '.env'), 'do-not-package');
    await expect(packageRelease({ projectRoot })).rejects.toThrow('Unexpected');
  });
});
