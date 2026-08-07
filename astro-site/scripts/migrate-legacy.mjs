import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const site = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(site, 'src/content/articles');
const publicDir = path.join(site, 'public');
const responsiveDir = path.join(publicDir, 'assets/responsive');
const coverDir = path.join(publicDir, 'assets/covers');
const animatedDir = path.join(publicDir, 'assets/animated');
const legacyAssetDir = path.join(publicDir, 'assets/legacy');
const compatDir = path.join(publicDir, 'compat');
const redirectDir = path.join(publicDir, 'articles');
const manifestDir = path.join(publicDir, 'manifests');
const generatedDirs = [contentDir, responsiveDir, coverDir, animatedDir, legacyAssetDir, compatDir, redirectDir, manifestDir];
const issues = [];

for (const directory of generatedDirs) {
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
}

await fs.mkdir(path.join(publicDir, 'assets/images'), { recursive: true });
for (const name of ['logo.png', 'logo_coloros.png', 'logo_originos.png', 'favicon.png', 'favicon_coloros.png', 'favicon_originos.png']) {
  const source = path.join(root, 'assets/images', name);
  try { await fs.copyFile(source, path.join(publicDir, 'assets/images', name)); } catch { /* optional legacy mark */ }
}

const hash = (value, length = 16) => createHash('sha1').update(value).digest('hex').slice(0, length);
const toPosix = (value) => value.split(path.sep).join('/');

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readData(file) {
  const raw = await fs.readFile(path.join(root, file), 'utf8');
  return JSON.parse(raw.replace(/^window\.articleData\s*=\s*/, '').replace(/;\s*$/, ''));
}

async function getCatalog(file, brand) {
  const html = await fs.readFile(path.join(root, file), 'utf8');
  const result = [];
  const yearMatches = [...html.matchAll(/<h3 class="nav-year">(\d{4})年<\/h3>/g)];
  for (const match of html.matchAll(/<a href="([^"]+)"[^>]*data-article="([^"]+)">([^<]+)<\/a>/g)) {
    const years = yearMatches.filter((year) => year.index < match.index);
    result.push({
      brand,
      year: Number(years.at(-1)?.[1] ?? new Date().getFullYear()),
      articleId: match[2],
      title: match[3].trim(),
      legacyPath: match[1].replace(/^articles\//, ''),
    });
  }
  return result;
}

function collectRefs(source) {
  const attributeRefs = [...source.matchAll(/(?:src|data-src|data-lazy-bgimg|href|xlink:href)=["']\/?(assets\/images\/[^"']+)["']/gi)].map((match) => match[1]);
  const cssRefs = [...source.matchAll(/url\(["']?\/?(assets\/images\/[^"')]+)["']?\)/gi)].map((match) => match[1]);
  return [...new Set([...attributeRefs, ...cssRefs].map((ref) => ref.replace(/&amp;.*$/, '')))];
}

function monthFromTitle(title) {
  const months = new Map([
    ['十二月', 12], ['十一月', 11], ['十月', 10], ['九月', 9], ['八月', 8], ['七月', 7],
    ['六月', 6], ['五月', 5], ['四月', 4], ['三月', 3], ['二月', 2], ['一月', 1], ['春节', 2],
  ]);
  for (const [label, month] of months) if (title.includes(label)) return month;
  return 1;
}

async function inspectRef(ref) {
  const input = path.join(root, ref);
  try {
    const stat = await fs.stat(input);
    if (!stat.size) throw new Error('文件为空');
    const metadata = await sharp(input, { animated: true }).metadata();
    return { input, stat, metadata, ready: true };
  } catch (error) {
    issues.push({ type: 'asset', ref, message: error.message });
    return { input, stat: null, metadata: null, ready: false };
  }
}

async function copyLegacyAsset(ref, inspected) {
  if (!inspected.ready) return undefined;
  const relative = ref.replace(/^assets\/images\//, '');
  const output = path.join(legacyAssetDir, relative);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.copyFile(inspected.input, output);
  return `assets/legacy/${toPosix(relative)}`;
}

async function optimizeStatic(ref, inspected) {
  if (!inspected.ready) return undefined;
  const key = hash(ref);
  const { metadata, input } = inspected;
  if ((metadata.pages ?? 1) > 1) {
    const output = path.join(animatedDir, `${key}.webp`);
    await sharp(input, { animated: true })
      .resize({ width: Math.min(960, metadata.width ?? 960), withoutEnlargement: true })
      .webp({ quality: 76, effort: 4 })
      .toFile(output);
    const frameHeight = metadata.pageHeight ?? metadata.height ?? 1;
    return {
      src: `assets/animated/${key}.webp`, srcset: `assets/animated/${key}.webp ${metadata.width ?? 960}w`,
      width: metadata.width ?? 960, height: frameHeight, animated: true,
    };
  }

  const widths = [480, 960, 1440];
  const variants = [];
  for (const width of widths) {
    const output = path.join(responsiveDir, `${key}-${width}.webp`);
    await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(output);
    variants.push({ width: Math.min(width, metadata.width ?? width), src: `assets/responsive/${key}-${width}.webp` });
  }
  return {
    src: variants[1].src,
    srcset: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
    width: metadata.width ?? 1080,
    height: metadata.height ?? 1600,
    animated: false,
  };
}

async function createCover(ref, inspected) {
  if (!inspected.ready) return undefined;
  const key = hash(`cover:${ref}`);
  const widths = [480, 800, 1200];
  const webp = [];
  const avif = [];
  for (const width of widths) {
    const height = Math.round(width * 9 / 16);
    const pipeline = () => sharp(inspected.input, { pages: 1 }).flatten({ background: '#f2f4f7' }).resize(width, height, { fit: 'cover', position: 'top' });
    const webpName = `${key}-${width}.webp`;
    const avifName = `${key}-${width}.avif`;
    await pipeline().webp({ quality: 80, effort: 4 }).toFile(path.join(coverDir, webpName));
    await pipeline().avif({ quality: 58, effort: 4 }).toFile(path.join(coverDir, avifName));
    webp.push({ width, src: `assets/covers/${webpName}` });
    avif.push({ width, src: `assets/covers/${avifName}` });
  }
  let dominantColor = '#20252b';
  try {
    const { dominant } = await sharp(inspected.input, { pages: 1 }).resize(64, 64, { fit: 'cover', position: 'top' }).stats();
    dominantColor = `#${[dominant.r, dominant.g, dominant.b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  } catch { /* deterministic fallback */ }
  return {
    src: webp.at(-1).src,
    srcset: webp.map((item) => `${item.src} ${item.width}w`).join(', '),
    avifSrcset: avif.map((item) => `${item.src} ${item.width}w`).join(', '),
    width: 1200,
    height: 675,
    alt: '',
    dominantColor,
    focalPoint: '50% 0%',
  };
}

function relativeAsset(value) {
  return value.split(', ').map((item) => {
    const [src, descriptor] = item.split(' ');
    return `../../../${src}${descriptor ? ` ${descriptor}` : ''}`;
  }).join(', ');
}

function normalizeGalleryHtml(source, assetMap) {
  let firstImage = true;
  return source.replace(/<img\b[^>]*>/gi, (originalTag) => {
    let tag = originalTag;
    const ref = tag.match(/(?:src|data-src)="\/?(assets\/images\/[^" ]+)"/i)?.[1];
    const asset = ref ? assetMap.get(ref) : null;
    if (asset) {
      const src = `../../../${asset.src}`;
      tag = tag.replace(/src="(?:data:image[^\"]*|\/?assets\/images\/[^\"]*)"/i, `src="${src}"`);
      tag = tag.replace(/data-src="\/?assets\/images\/[^\"]*"/i, `data-src="${src}"`);
      if (!/\bsrcset=/i.test(tag)) tag = tag.replace(/(<img\b[^>]*?)(\/?>)$/i, `$1 srcset="${relativeAsset(asset.srcset)}" sizes="(max-width: 760px) 100vw, 760px"$2`);
      if (!/\bwidth=/i.test(tag)) tag = tag.replace(/(<img\b)/i, `$1 width="${asset.width}" height="${asset.height}"`);
    }
    const dataSrc = tag.match(/data-src="([^"]+)"/i)?.[1];
    if (dataSrc && /src="data:image/i.test(tag)) tag = tag.replace(/src="data:image[^"]*"/i, `src="${dataSrc}"`);
    tag = tag.replace(/\sloading="[^"]*"/i, '').replace(/\sfetchpriority="[^"]*"/i, '');
    tag = tag.replace(/<img/i, `<img loading="${firstImage ? 'eager' : 'lazy'}" decoding="async"${firstImage ? ' fetchpriority="high"' : ''}`);
    firstImage = false;
    return tag;
  });
}

function compatibilityDocument(article, source, missingRefs) {
  const cleanedSource = source
    .replace(/&amp;(?:tp|wxfrom|wx_lazy)=[^&"' )]+/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const head = cleanedSource.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const body = cleanedSource.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? cleanedSource;
  const headAssets = [...head.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((match) => match[0]).join('\n');
  let rewritten = `${headAssets}\n${body}`.replace(/\/?assets\/images\//g, '../../../assets/legacy/');
  const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  for (const ref of missingRefs) rewritten = rewritten.replaceAll(`../../../assets/legacy/${ref.replace(/^assets\/images\//, '')}`, transparentPixel);
  const safeTitle = article.title.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]);
  const missingBanner = missingRefs.length ? '<aside class="media-fallback" role="status">部分图片暂时无法显示。</aside>' : '';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${safeTitle}</title><style>
:root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;min-width:0;background:#fff}body{overflow-x:hidden;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.compat-root{width:100%;min-height:100vh;overflow:hidden}.compat-root img,.compat-root video,.compat-root svg{max-width:100%;height:auto}.media-fallback{display:grid;place-items:center;min-height:160px;padding:24px;border:1px dashed #d7dbe1;border-radius:16px;color:#737983;background:#f6f7f9;font-size:14px}
</style></head><body data-compat-id="${article.slug}"><main class="compat-root">${missingBanner}${rewritten}</main>
<script>
(()=>{const id=document.body.dataset.compatId;const report=()=>parent.postMessage({type:'os-archive:resize',id,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)},'*');
const reveal=(el)=>{const url=el.getAttribute('data-lazy-bgimg');if(url){const probe=new Image();probe.onload=()=>{el.style.setProperty('background-image','url("'+url+'")','important');report()};probe.onerror=()=>el.insertAdjacentHTML('afterend','<div class="media-fallback">该背景媒体暂不可用</div>');probe.src=url}}
const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){reveal(entry.target);observer.unobserve(entry.target)}}),{rootMargin:'800px 0px'}):null;
document.querySelectorAll('[data-lazy-bgimg]').forEach(el=>observer?observer.observe(el):reveal(el));document.querySelectorAll('img[data-src]').forEach(img=>{img.loading='lazy';img.src=img.dataset.src});document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(img.dataset.failed)return;img.dataset.failed='1';const fallback=document.createElement('div');fallback.className='media-fallback';fallback.textContent='该图片暂不可用';img.replaceWith(fallback);report()}));
if('ResizeObserver'in window)new ResizeObserver(report).observe(document.body);addEventListener('load',report);document.fonts?.ready.then(report);setTimeout(report,100);setTimeout(report,600);setTimeout(report,1600)})();
</script></body></html>`;
}

async function buildVideoManifest() {
  const micrositeAssets = path.join(root, 'Archive_Data/www.coloros.com/version/coloros16/assets');
  const files = await fs.readdir(micrositeAssets).catch(() => []);
  const bundle = files.find((name) => /^index-.*\.js$/.test(name));
  if (!bundle) return [];
  const source = await fs.readFile(path.join(micrositeAssets, bundle), 'utf8');
  const refs = [...new Set([...source.matchAll(/\$\{re\}\/([^`]+?\.mp4)/g)].map((match) => match[1]))];
  const videoRoot = path.join(root, 'Archive_Data/coloros-website-cn.allawnfs.com/website-resource-20260421/os1611776774710000/video');
  const media = [];
  for (const ref of refs) {
    const file = path.join(videoRoot, ref);
    let status = 'missing';
    let bytes = 0;
    try {
      const stat = await fs.stat(file);
      if (stat.size > 0) { status = 'ready'; bytes = stat.size; }
    } catch { /* represented explicitly below */ }
    media.push({ id: hash(`video:${ref}`, 12), kind: 'video', src: `video/${toPosix(ref)}`, bytes, status });
  }
  return media;
}

const [colorosData, originosData, colorosCatalog, originosCatalog, videos] = await Promise.all([
  readData('data.js'), readData('data_originos.js'), getCatalog('index.html', 'coloros'), getCatalog('originos.html', 'originos'), buildVideoManifest(),
]);
const catalog = [...colorosCatalog, ...originosCatalog];
const inspectedCache = new Map();
const optimizedCache = new Map();
const articles = [];

for (let index = 0; index < catalog.length; index += 1) {
  const item = catalog[index];
  const source = item.brand === 'coloros' ? colorosData[item.articleId] : originosData[item.articleId];
  if (!source) {
    issues.push({ type: 'article', ref: item.articleId, message: 'data.js 中缺少文章内容' });
    continue;
  }
  const slug = `${String(index + 1).padStart(2, '0')}-${item.articleId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'update'}`;
  const interactiveSource = path.join(root, 'assets/interactive', item.legacyPath);
  const isInteractive = await exists(interactiveSource);
  const kind = isInteractive ? (item.articleId === 'ColorOS_16_正式发布！亮点抢先看' ? 'microsite' : 'interactive') : 'gallery';
  const renderSource = source;
  const refs = collectRefs(renderSource);
  const media = [];
  const missingRefs = [];
  let cover;
  const assetMap = new Map();

  for (const ref of refs) {
    if (!inspectedCache.has(ref)) inspectedCache.set(ref, await inspectRef(ref));
    const inspected = inspectedCache.get(ref);
    if (!inspected.ready) missingRefs.push(ref);
    const legacySrc = isInteractive ? await copyLegacyAsset(ref, inspected) : undefined;
    if (!isInteractive) {
      if (!optimizedCache.has(ref)) optimizedCache.set(ref, await optimizeStatic(ref, inspected));
      const optimized = optimizedCache.get(ref);
      if (optimized) assetMap.set(ref, optimized);
    }
    if (!cover && inspected.ready) cover = await createCover(ref, inspected);
    media.push({
      id: hash(ref, 12),
      kind: (inspected.metadata?.pages ?? 1) > 1 ? 'animated-image' : 'image',
      src: legacySrc ?? assetMap.get(ref)?.src,
      width: inspected.metadata?.width ?? 0,
      height: inspected.metadata?.pageHeight ?? inspected.metadata?.height ?? 0,
      bytes: inspected.stat?.size ?? 0,
      status: inspected.ready ? 'ready' : 'missing',
    });
  }

  if (!cover) {
    const fallbackRef = `assets/images/logo_${item.brand}.png`;
    if (!inspectedCache.has(fallbackRef)) inspectedCache.set(fallbackRef, await inspectRef(fallbackRef));
    cover = await createCover(fallbackRef, inspectedCache.get(fallbackRef));
  }

  const article = {
    articleId: item.articleId,
    order: index + 1,
    title: item.title,
    brand: item.brand,
    year: item.year,
    publishedAt: `${item.year}-${String(monthFromTitle(item.title)).padStart(2, '0')}-01`,
    slug,
    kind,
    legacyPath: item.legacyPath,
    html: isInteractive ? '' : normalizeGalleryHtml(source, assetMap),
    compatPath: isInteractive ? `compat/${item.brand}/${slug}/index.html` : undefined,
    cover: cover ? { ...cover, alt: `${item.title} 封面` } : undefined,
    media: kind === 'microsite' ? [...media, ...videos] : media,
    experience: kind === 'microsite' ? {
      slug: 'coloros16', title: 'ColorOS 16 完整交互体验',
      ready: videos.filter((video) => video.status === 'ready').length,
      total: videos.length,
      entryPath: 'coloros16/',
    } : undefined,
  };

  await fs.writeFile(path.join(contentDir, `${String(index + 1).padStart(2, '0')}-${item.brand}.json`), JSON.stringify(article, null, 2));
  if (isInteractive) {
    const directory = path.join(compatDir, item.brand, slug);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'index.html'), compatibilityDocument(article, renderSource, missingRefs));
  }

  const redirectTarget = `../${item.brand}/${item.year}/${slug}/`;
  await fs.writeFile(path.join(redirectDir, item.legacyPath), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${redirectTarget}"><link rel="canonical" href="${redirectTarget}"><title>正在跳转…</title></head><body><a href="${redirectTarget}">打开新版文章</a><script>location.replace(new URL(${JSON.stringify(redirectTarget)},location.href))</script></body></html>`);
  articles.push(article);
}

await fs.writeFile(path.join(manifestDir, 'legacy-routes.json'), JSON.stringify(Object.fromEntries(articles.map((article) => [article.articleId, `${article.brand}/${article.year}/${article.slug}/`])), null, 2));
await fs.writeFile(path.join(manifestDir, 'coloros16-media.json'), JSON.stringify(videos, null, 2));
await fs.writeFile(path.join(manifestDir, 'migration-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), articles: articles.length, interactive: articles.filter((article) => article.kind !== 'gallery').length, issues }, null, 2));

console.log(`Migrated ${articles.length} articles (${articles.filter((article) => article.kind !== 'gallery').length} interactive).`);
console.log(`ColorOS 16 videos: ${videos.filter((video) => video.status === 'ready').length}/${videos.length} locally archived.`);
if (issues.length) console.warn(`Migration completed with ${issues.length} explicit media issue(s); see public/manifests/migration-report.json.`);
