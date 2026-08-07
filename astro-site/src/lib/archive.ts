import { getCollection, type CollectionEntry } from 'astro:content';

export type Brand = 'coloros' | 'originos';
export type ArchiveArticle = CollectionEntry<'articles'>;

export const brandMeta: Record<Brand, { name: string; accent: string; soft: string; logo: string; summary: string }> = {
  coloros: {
    name: 'ColorOS',
    accent: '#00a99d',
    soft: '#dff6f2',
    logo: 'assets/images/logo_coloros.png',
    summary: 'OPPO 系统月度更新、正式版计划与体验亮点。',
  },
  originos: {
    name: 'OriginOS',
    accent: '#5267ff',
    soft: '#e7eaff',
    logo: 'assets/images/logo_originos.png',
    summary: 'vivo 系统体验升级、设计变化与功能档案。',
  },
};

export function sitePath(path = '') {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${path.replace(/^\/+/, '')}`;
}

export async function getArticles(brand?: Brand) {
  const entries = await getCollection('articles');
  return entries
    .filter((entry) => !brand || entry.data.brand === brand)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getYears(brand: Brand) {
  return [...new Set((await getArticles(brand)).map((entry) => entry.data.year))].sort((a, b) => b - a);
}

export function articlePath(article: ArchiveArticle) {
  return sitePath(`${article.data.brand}/${article.data.year}/${article.data.slug}/`);
}

export function assetPath(path?: string) {
  if (!path) return undefined;
  if (/^(?:https?:)?\/\//.test(path)) return path;
  return sitePath(path);
}
