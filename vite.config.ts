import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://ovska.github.io/spin/ on GitHub Pages, but from the
  // root during local dev.
  base: command === 'build' ? '/spin/' : '/',
  plugins: [preact()],
}))
