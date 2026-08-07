import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = path.resolve(import.meta.dirname, '../dist');

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const files = await walk(dist);
const sizes = await Promise.all(files.map(async (file) => {
  const bytes = await fs.readFile(file);
  return { file, size: bytes.byteLength, gzip: gzipSync(bytes).byteLength };
}));
const byExtension = (extension) => sizes.filter(({ file }) => file.endsWith(extension));
const total = (items, key = 'size') => items.reduce((sum, item) => sum + item[key], 0);
const htmlFiles = byExtension('.html');
const jsFiles = byExtension('.js');
const cssFiles = byExtension('.css');
const rootHtmlPath = path.join(dist, 'index.html');
const rootHtml = await fs.readFile(rootHtmlPath, 'utf8');
const rootEntry = sizes.find(({ file }) => file === rootHtmlPath);
const basePrefix = (process.env.PUBLIC_BASE_PATH || '/').replace(/^\//, '').replace(/\/$/, '');
const resolvePublic = (url) => {
  const clean = decodeURI(url.split(/[?#]/)[0]).replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '');
  const withoutBase = basePrefix && clean.startsWith(`${basePrefix}/`) ? clean.slice(basePrefix.length + 1) : clean;
  return path.join(dist, withoutBase);
};
const rootRefs = [...new Set([...rootHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]).filter((value) => !value.startsWith('#')))];
const rootAssets = sizes.filter(({ file }) => rootRefs.some((ref) => resolvePublic(ref) === file));
const rootCoverAssets = rootAssets.filter(({ file }) => file.includes(`${path.sep}assets${path.sep}covers${path.sep}`));

const metrics = {
  javascriptGzip: total(jsFiles, 'gzip'),
  cssGzip: total(cssFiles, 'gzip'),
  homepageShellGzip: (rootEntry?.gzip ?? 0) + total(rootAssets.filter(({ file }) => /\.(?:css|js)$/i.test(file)), 'gzip'),
  homepageTotal: (rootEntry?.size ?? 0) + total(rootAssets),
  homepageCover: Math.max(0, ...rootCoverAssets.map(({ size }) => size)),
  largestHtml: Math.max(0, ...htmlFiles.map(({ size }) => size)),
};
const limits = {
  javascriptGzip: 35 * 1024,
  cssGzip: 45 * 1024,
  homepageShellGzip: 150 * 1024,
  homepageTotal: 450 * 1024,
  homepageCover: 200 * 1024,
  largestHtml: 200 * 1024,
};

console.log('Per-route performance budget');
for (const [name, actual] of Object.entries(metrics)) console.log(`- ${name}: ${(actual / 1024).toFixed(1)}KB / ${(limits[name] / 1024).toFixed(1)}KB`);
console.log(`- generated output: ${(total(sizes) / 1024 / 1024).toFixed(1)}MB (${files.length} files; compatibility media excluded from first-load budgets)`);

const failures = Object.entries(metrics).filter(([name, actual]) => actual > limits[name]).map(([name]) => name);
if (/<(?:iframe|video)\b/i.test(rootHtml)) failures.push('homepageDeferredMedia');
if (failures.length) {
  console.error(`Budget exceeded: ${[...new Set(failures)].join(', ')}`);
  process.exitCode = 1;
}
