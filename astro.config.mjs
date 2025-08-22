import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    react(),
    tailwind()
  ],
  output: 'static',
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});