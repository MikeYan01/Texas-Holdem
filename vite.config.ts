import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this repository as a project site, at
// https://mikeyan01.github.io/Texas-Holdem/ rather than at a domain root, so the
// production build has to reference its assets from that prefix. `serve` keeps
// the root path, because the dev server has no such prefix.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/Texas-Holdem/',
  build: {
    target: 'es2022',
  },
}));
