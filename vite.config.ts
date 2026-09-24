import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH permite publicar en un subdirectorio (ej. GitHub Pages: BASE_PATH=/demos/).
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
