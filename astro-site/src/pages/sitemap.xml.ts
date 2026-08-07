import { articlePath, getArticles, sitePath } from '../lib/archive';

export const prerender = true;
const siteUrl = (import.meta.env.PUBLIC_SITE_URL || 'https://ricky2036.github.io/ColorOS_Updates_Web').replace(/\/$/, '');

export async function GET() {
  const paths = [sitePath(), sitePath('coloros/'), sitePath('originos/'), ...(await getArticles()).map(articlePath)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((value) => `<url><loc>${new URL(value.replace(/^\//, ''), `${siteUrl}/`)}</loc></url>`).join('')}</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
