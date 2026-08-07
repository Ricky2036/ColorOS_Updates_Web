export const prerender = true;

const siteUrl = (import.meta.env.PUBLIC_SITE_URL || 'https://ricky2036.github.io/ColorOS_Updates_Web').replace(/\/$/, '');
const base = (import.meta.env.BASE_URL || '/').replace(/^\//, '');

export async function GET() {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL(`${base}sitemap.xml`, `${siteUrl}/`)}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
