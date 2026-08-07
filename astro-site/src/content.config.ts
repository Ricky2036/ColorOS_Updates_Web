import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const responsiveImage = z.object({
  src: z.string(),
  srcset: z.string(),
  avifSrcset: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/articles' }),
  schema: z.object({
    articleId: z.string(),
    order: z.number().int().positive(),
    title: z.string(),
    brand: z.enum(['coloros', 'originos']),
    year: z.number().int(),
    publishedAt: z.string(),
    slug: z.string(),
    kind: z.enum(['gallery', 'interactive', 'microsite']),
    legacyPath: z.string(),
    html: z.string().default(''),
    compatPath: z.string().optional(),
    cover: responsiveImage.extend({
      alt: z.string(),
      dominantColor: z.string(),
      focalPoint: z.string(),
    }).optional(),
    media: z.array(z.object({
      id: z.string(),
      kind: z.enum(['image', 'animated-image', 'video']),
      src: z.string().optional(),
      poster: z.string().optional(),
      width: z.number().int().nonnegative().optional(),
      height: z.number().int().nonnegative().optional(),
      bytes: z.number().int().nonnegative().optional(),
      status: z.enum(['ready', 'missing']),
    })).default([]),
    experience: z.object({
      slug: z.string(),
      title: z.string(),
      ready: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      entryPath: z.string(),
    }).optional(),
  }),
});

export const collections = { articles };
