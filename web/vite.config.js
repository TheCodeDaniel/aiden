import { defineConfig } from 'vite';

// Minimal Vite config — no special plugins needed for plain JS + Three.js + viem.
export default defineConfig({
  // base tells Vite where the app is served from.
  // On GitHub Pages it lives at https://<user>.github.io/<repo>/
  // so the base must match the repo name.
  // For local dev (npm run dev) this is ignored — Vite serves from /.
  base: '/aiden/',
});
