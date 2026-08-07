import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(site, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.gif': 'image/gif', '.mp4': 'video/mp4' };
const server = http.createServer(async (request, response) => {
  try {
    const url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.join(dist, url.replace(/^\/+/, ''));
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    if (!path.extname(file) && !fsSync.existsSync(file)) file = path.join(file, 'index.html');
    const bytes = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser;

try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    if (!reason.includes('ERR_ABORTED')) errors.push(`Request failed (${reason}): ${request.url()}`);
  });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    const response = await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });
    if (!response?.ok()) throw new Error(`Homepage returned ${response?.status()}`);
    const layout = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth, feature: document.querySelector('.editorial-feature')?.getBoundingClientRect().height ?? 0, menu: Boolean(document.querySelector('.menu-button')) }));
    if (layout.body > layout.viewport + 1) throw new Error(`Horizontal overflow at ${width}px: ${layout.body}/${layout.viewport}`);
    if (layout.feature > 760) throw new Error(`Homepage feature is too tall at ${width}px: ${layout.feature}`);
    if (layout.menu) throw new Error('Homepage rendered an orphan archive menu button');
  }

  await page.setViewport({ width: 390, height: 820 });
  await page.goto(`${origin}/coloros/`, { waitUntil: 'networkidle0' });
  if (!page.url().includes('/coloros/2026/01-oppo-coloros-2026/')) throw new Error(`ColorOS entry did not open the latest article: ${page.url()}`);
  await page.click('.menu-button');
  if (!await page.$eval('#archive-nav', (element) => element.classList.contains('open'))) throw new Error('Mobile archive drawer did not open');
  await page.keyboard.press('Escape');
  if (await page.$eval('#archive-nav', (element) => element.classList.contains('open'))) throw new Error('Mobile archive drawer did not close with Escape');
  if (await page.$('[data-archive-search]')) throw new Error('Removed archive search is still rendered');

  const articles = await Promise.all((await fs.readdir(path.join(site, 'src/content/articles'))).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await fs.readFile(path.join(site, 'src/content/articles', name), 'utf8'))));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${origin}/originos/`, { waitUntil: 'networkidle0' });
  if (!page.url().includes('/originos/2026/21-originos-6/')) throw new Error(`OriginOS entry did not open the latest article: ${page.url()}`);
  const originSurface = await page.$eval('.interactive-archive', (element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, backgroundImage: style.backgroundImage, backdropFilter: style.backdropFilter || style.webkitBackdropFilter, top: style.paddingTop, right: style.paddingRight, bottom: style.paddingBottom, left: style.paddingLeft };
  });
  if ((originSurface.background === 'rgba(0, 0, 0, 0)' && originSurface.backgroundImage === 'none') || originSurface.backdropFilter === 'none' || new Set([originSurface.top, originSurface.right, originSurface.bottom, originSurface.left]).size !== 1) throw new Error(`OriginOS article surface is inconsistent: ${JSON.stringify(originSurface)}`);
  await page.goto(`${origin}/coloros/2026/01-oppo-coloros-2026/`, { waitUntil: 'networkidle0' });
  const ambientState = await page.$$eval('.ambient-blob', (elements) => ({ count: elements.length, animations: elements.map((element) => getComputedStyle(element).animationName) }));
  if (ambientState.count !== 8 || ambientState.animations.some((name) => name === 'none')) throw new Error(`Ambient background motion is missing: ${JSON.stringify(ambientState)}`);
  const timeline = await page.evaluate(() => {
    const textLeft = (element) => {
      if (!element?.firstChild) return 0;
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().left;
    };
    const year = document.querySelector('.year-group h2');
    const active = document.querySelector('.year-group a.active span');
    const inactive = document.querySelector('.year-group a:not(.active) span');
    const activeLink = document.querySelector('.year-group a.active');
    const line = document.querySelector('.year-group ul');
    const lineStyle = getComputedStyle(line, '::before');
    const marker = activeLink?.querySelector('.timeline-marker');
    const markerRect = marker?.getBoundingClientRect();
    return {
      year: textLeft(year),
      active: active?.getBoundingClientRect().left ?? 0,
      inactive: inactive?.getBoundingClientRect().left ?? 0,
      line: (line?.getBoundingClientRect().left ?? 0) + Number.parseFloat(lineStyle.left) + Number.parseFloat(lineStyle.width) / 2,
      marker: markerRect ? markerRect.left + markerRect.width / 2 : 0,
      textY: (activeLink?.getBoundingClientRect().top ?? 0) + Number.parseFloat(getComputedStyle(activeLink).paddingTop) + Number.parseFloat(getComputedStyle(activeLink).lineHeight) / 2,
      markerY: markerRect ? markerRect.top + markerRect.height / 2 : 0,
    };
  });
  if (Math.abs(timeline.year - timeline.line) > .5 || Math.abs(timeline.active - timeline.inactive) > .5 || Math.abs(timeline.line - timeline.marker) > .25 || Math.abs(timeline.textY - timeline.markerY) > .5) throw new Error(`Archive timeline is misaligned: ${JSON.stringify(timeline)}`);
  const colorNavTitles = await page.$$eval('.year-group a span', (elements) => elements.map((element) => element.textContent?.trim() ?? ''));
  if (colorNavTitles.some((title) => /^OPPO\s+/i.test(title))) throw new Error(`ColorOS navigation still contains OPPO prefix: ${colorNavTitles.find((title) => /^OPPO\s+/i.test(title))}`);
  if (colorNavTitles.some((title) => /^手机系统\s+/.test(title))) throw new Error(`ColorOS navigation still contains 手机系统 prefix: ${colorNavTitles.find((title) => /^手机系统\s+/.test(title))}`);
  const articleWidth = await page.$eval('.article-layout', (element) => element.getBoundingClientRect().width);
  if (articleWidth < 995 || articleWidth > 1005) throw new Error(`Desktop article width is not 85% of the previous layout: ${articleWidth}`);
  const articleGrid = await page.$eval('.article-layout', (element) => {
    const style = getComputedStyle(element);
    return { columns: style.gridTemplateColumns.split(' ').map(Number.parseFloat), gap: Number.parseFloat(style.columnGap) };
  });
  if (Math.abs(articleGrid.columns[0] - 280) > .5 || Math.abs(articleGrid.gap - 10) > .5) throw new Error(`Archive column did not reuse the existing gap: ${JSON.stringify(articleGrid)}`);
  const lastGalleryImageMargin = await page.$eval('.gallery-content .image-gallery img:last-child', (element) => getComputedStyle(element).marginBottom);
  if (Number.parseFloat(lastGalleryImageMargin) !== 0) throw new Error(`Gallery bottom spacing is inconsistent: ${lastGalleryImageMargin}`);
  let interactiveSurfaceCount = 0;
  let horizontalInteractionCount = 0;
  for (const interactive of articles.filter((article) => article.kind !== 'gallery')) {
    await page.goto(`${origin}/${interactive.brand}/${interactive.year}/${interactive.slug}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-compat-frame]');
    const articleText = await page.$eval('.article-content', (element) => element.textContent);
    if (articleText.includes('原始交互已恢复') || articleText.includes('隔离环境') || await page.$('.interactive-toolbar a')) throw new Error(`Implementation copy or standalone link is visible: ${interactive.slug}`);
    const sandbox = await page.$eval('[data-compat-frame]', (element) => element.getAttribute('sandbox') ?? '');
    if (!sandbox.includes('allow-scripts') || !sandbox.includes('allow-same-origin')) throw new Error(`Interactive media sandbox cannot load local assets: ${interactive.slug}`);
    const frame = page.frames().find((item) => item.url().includes(`/compat/${interactive.brand}/${interactive.slug}/index.html`));
    if (!frame) throw new Error(`Interactive compatibility frame did not load: ${interactive.slug}`);
    if (!await frame.$('.compat-root')) throw new Error(`Interactive compatibility content is missing: ${interactive.slug}`);
    const frameState = await frame.evaluate(() => {
      const scroller = [...document.querySelectorAll('*')].find((element) => element.scrollWidth > element.clientWidth + 8 && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX));
      let horizontalMoved = false;
      if (scroller) {
        scroller.scrollLeft = Math.min(100, scroller.scrollWidth - scroller.clientWidth);
        horizontalMoved = scroller.scrollLeft > 0;
      }
      return { height: document.documentElement.scrollHeight, media: document.querySelectorAll('img,svg,video').length, notFound: document.body.textContent.includes('404 / Not found'), interactive: Boolean(document.querySelector('animate,animateTransform,set')) || horizontalMoved, horizontalMoved };
    });
    if (frameState.notFound || frameState.height < 300 || frameState.media < 1) throw new Error(`Interactive compatibility content is invalid: ${interactive.slug}`);
    const embeddedHeight = await page.$eval('[data-compat-frame]', (element) => element.getBoundingClientRect().height);
    if (Math.abs(embeddedHeight - frameState.height) > 3) throw new Error(`Interactive page still uses an inner vertical scroller: ${interactive.slug} (${embeddedHeight}/${frameState.height})`);
    if (frameState.interactive) interactiveSurfaceCount += 1;
    if (frameState.horizontalMoved) horizontalInteractionCount += 1;
  }
  if (interactiveSurfaceCount < 4) throw new Error(`Too few restored interactive surfaces: ${interactiveSurfaceCount}`);
  if (horizontalInteractionCount < 2) throw new Error(`Horizontal interactions did not respond: ${horizontalInteractionCount}`);

  for (const slug of ['02-oppo-coloros', '03-oppo-coloros']) {
    await page.goto(`${origin}/coloros/2026/${slug}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-gallery-shell].loaded', { timeout: 10000 });
    const opacity = await page.$eval('.gallery-content', (element) => getComputedStyle(element).opacity);
    if (opacity !== '1') throw new Error(`Long gallery remained hidden: ${slug}`);
  }

  for (const article of articles) {
    const response = await page.goto(`${origin}/${article.brand}/${article.year}/${article.slug}/`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`Article failed: ${article.slug}`);
  }
  if (errors.length) throw new Error(`Browser console/network errors:\n${errors.slice(0, 12).join('\n')}`);
  console.log(`Browser verified: responsive layout, drawer, compatibility frame and ${articles.length} article routes.`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
