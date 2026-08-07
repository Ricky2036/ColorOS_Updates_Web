import fs from 'node:fs/promises';
import path from 'node:path';

const site = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(site, 'src/content/articles');
const compatDir = path.join(site, 'public/compat');
const manifestDir = path.join(site, 'public/manifests');
const files = (await fs.readdir(contentDir)).filter((name) => name.endsWith('.json')).sort();
const articles = await Promise.all(files.map(async (name) => JSON.parse(await fs.readFile(path.join(contentDir, name), 'utf8'))));
const fail = (message) => { throw new Error(message); };

if (articles.length !== 29) fail(`Expected 29 articles, found ${articles.length}`);
if (new Set(articles.map((article) => article.articleId)).size !== 29) fail('Article IDs are not unique');
if (new Set(articles.map((article) => `${article.brand}/${article.year}/${article.slug}`)).size !== 29) fail('Article routes are not unique');
const interactive = articles.filter((article) => article.kind !== 'gallery');
if (interactive.length !== 16) fail(`Expected 16 interactive articles, found ${interactive.length}`);
for (const article of articles) {
  if (!article.title || !article.legacyPath || !article.cover) fail(`Incomplete metadata: ${article.articleId}`);
  if (article.kind === 'gallery' && !article.html) fail(`Gallery has no HTML: ${article.articleId}`);
  if (article.kind !== 'gallery') {
    const compat = path.join(compatDir, article.brand, article.slug, 'index.html');
    if (!(await fs.stat(compat).catch(() => null))?.size) fail(`Missing compatibility page: ${article.articleId}`);
  }
}
const videos = JSON.parse(await fs.readFile(path.join(manifestDir, 'coloros16-media.json'), 'utf8'));
if (videos.length !== 59) fail(`Expected 59 ColorOS 16 video references, found ${videos.length}`);
if (videos.filter((video) => video.status === 'ready').length !== 30) fail('Unexpected local ColorOS 16 video inventory');
const migration = JSON.parse(await fs.readFile(path.join(manifestDir, 'migration-report.json'), 'utf8'));
if (migration.articles !== 29 || migration.interactive !== 16) fail('Migration report does not match the catalog');
console.log(`Content verified: ${articles.length} articles, ${interactive.length} interactive pages, ${videos.filter((video) => video.status === 'ready').length}/${videos.length} videos archived.`);
