import { defineConfig } from 'astro/config';

const base = process.env.PUBLIC_BASE_PATH || '/';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://ricky2036.github.io/ColorOS_Updates_Web',
  base,
  output: 'static',
  compressHTML: true,
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
});
