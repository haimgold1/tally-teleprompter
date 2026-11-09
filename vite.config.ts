import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { serviceWorker } from './build/sw-plugin';

export default defineConfig({
  // Relative base: the same build works at any GitHub Pages sub-path.
  base: './',
  plugins: [preact(), serviceWorker()],
  build: {
    target: ['es2020', 'safari16'],
    assetsInlineLimit: 0,
    cssCodeSplit: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
