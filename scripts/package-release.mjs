import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { constants, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNoBundledSecrets } from './release-safety.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const EXTENSION_ROOTS = new Set(['manifest.json', 'background.js', 'document-translate.html', 'options.html',
  'popup.html', 'privacy.html', 'text-translate.html', 'icons', 'assets', 'chunks', 'content-scripts']);

async function copy(source, target) {
  const info = await lstat(source);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Not a regular release file: ${source}`);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target, constants.COPYFILE_EXCL);
  await chmod(target, 0o644);
}

async function filesIn(root, prefix = '') {
  const result = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    if (name.startsWith('.') || name.endsWith('.map') || /[\r\n]/.test(name)) throw new Error(`Unexpected release file: ${name}`);
    const relative = prefix ? `${prefix}/${name}` : name;
    const info = await lstat(join(root, relative));
    if (info.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${relative}`);
    if (info.isDirectory()) result.push(...await filesIn(root, relative));
    else if (info.isFile()) result.push(relative);
    else throw new Error(`Unsupported release entry: ${relative}`);
  }
  return result;
}

function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${binary} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}

async function archive(root, output) {
  const files = (await filesIn(root)).sort();
  command('zip', ['-q', '-X', output, '-@'], { cwd: root, input: `${files.join('\n')}\n` });
  command('unzip', ['-tq', output]);
  const entries = command('unzip', ['-Z1', output]).trim().split('\n').sort();
  if (JSON.stringify(entries) !== JSON.stringify(files)) throw new Error('ZIP entries differ from release files');
  const bytes = await readFile(output);
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function packageRelease({ projectRoot = project, outputRoot = join(projectRoot, 'releases') } = {}) {
  const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  const version = pkg.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
  const lock = JSON.parse(await readFile(join(projectRoot, 'package-lock.json'), 'utf8'));
  if (lock.version !== version || lock.packages[''].version !== version) throw new Error('Lockfile version mismatch');
  const license = await readFile(join(projectRoot, 'LICENSE'), 'utf8');
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(license)) throw new Error('Unresolved LICENSE conflict');
  for (const browser of ['chrome-mv3', 'firefox-mv2']) {
    const built = join(projectRoot, '.output', browser);
    const manifest = JSON.parse(await readFile(join(built, 'manifest.json'), 'utf8'));
    if (manifest.version !== version || manifest.permissions.includes('nativeMessaging')) throw new Error(`Stale ${browser} build`);
    if (manifest.permissions.some((permission) => ['tabs', 'activeTab'].includes(permission))) throw new Error(`Redundant permissions in ${browser}`);
    if (manifest.manifest_version !== (browser === 'chrome-mv3' ? 3 : 2)) throw new Error('Wrong manifest format');
    if (manifest.key || manifest.update_url) throw new Error('Unexpected signing/update configuration; review before packaging');
    for (const page of ['popup.html', 'privacy.html']) {
      if (!(await readFile(join(built, page), 'utf8')).includes(`v${version}`)) throw new Error(`Stale UI version: ${page}`);
    }
    for (const entry of await readdir(built)) if (!EXTENSION_ROOTS.has(entry)) throw new Error(`Unexpected extension root entry: ${entry}`);
    for (const file of await filesIn(built)) {
      if (/\.(?:json|html|js|mjs|css|svg)$/.test(file)) assertNoBundledSecrets(await readFile(join(built, file), 'utf8'), file);
    }
  }

  outputRoot = resolve(outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const destination = join(outputRoot, `aiTran-${version}`);
  try { await lstat(destination); throw new Error(`Release already exists; preserve or move it before rebuilding: ${destination}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // A failed package stays in a hidden staging directory, never masquerading as a finished release.
  const stage = await mkdtemp(join(outputRoot, `.aiTran-${version}-`));
  const builtAt = new Date().toISOString();
  const render = (text) => text.replaceAll('{{VERSION}}', version).replaceAll('{{DATE}}', builtAt.slice(0, 10));
  const artifacts = [];
  for (const [source, target, suffix] of [['chrome-mv3', 'chrome', 'chrome'], ['firefox-mv2', 'firefox', 'firefox-unsigned']]) {
    const built = join(projectRoot, '.output', source);
    const unpacked = join(stage, target);
    for (const file of await filesIn(built)) {
      if (!/\.(json|html|js|mjs|css|png|svg|woff2?|ttf|wasm)$/.test(file)) throw new Error(`Unexpected bundled file: ${file}`);
      await copy(join(built, file), join(unpacked, file));
    }
    await copy(join(projectRoot, 'LICENSE'), join(unpacked, 'LICENSE'));
    await copy(join(projectRoot, 'node_modules/pdfjs-dist/LICENSE'), join(unpacked, 'licenses/pdfjs-dist-LICENSE'));
    const name = `aiTran-${version}-${suffix}.zip`;
    artifacts.push({ name, ...await archive(unpacked, join(stage, name)) });
  }
  for (const file of ['LICENSE', 'PRIVACY.md', 'CHANGELOG.md', 'docs/CHROME_WEB_STORE.md', 'docs/TRANSLATION_TEST_MATRIX.md']) {
    await copy(join(projectRoot, file), join(stage, file));
  }
  await writeFile(join(stage, 'README.md'), render(await readFile(join(projectRoot, 'distribution/RELEASE_README.md'), 'utf8')));
  await writeFile(join(stage, 'SHA256SUMS.txt'), artifacts.map((artifact) => `${artifact.sha256}  ${artifact.name}\n`).join(''));
  await writeFile(join(stage, 'release.json'), `${JSON.stringify({ version, builtAt, signed: false, published: false, artifacts }, null, 2)}\n`);
  await rename(stage, destination);
  return { directory: destination, version, artifacts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  packageRelease().then((result) => {
    console.log(`Release v${result.version}: ${result.directory}`);
    for (const file of result.artifacts) console.log(`${file.name} (${file.bytes} bytes) SHA256 ${file.sha256}`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
