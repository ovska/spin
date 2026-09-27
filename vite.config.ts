import { execSync } from 'node:child_process'
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// Tag description if one's reachable from HEAD, else the short commit hash
// (--always's fallback) - shown in the header, see src/app.tsx.
function gitVersion(): string {
  try {
    return execSync('git describe --tags --always', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://ovska.github.io/spin/ on GitHub Pages, but from the
  // root during local dev.
  base: command === 'build' ? '/spin/' : '/',
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
  },
}))
