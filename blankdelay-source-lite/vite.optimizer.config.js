import { cpSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const publicFiles = [
  'favicon.png',
  'Blank Delay Logo.png',
  'itachi-headband.jpg',
  'apex-3-tkl.png',
  'g502.webp',
  'ps5.glb',
  'xbox.glb',
  'draco',
  'team',
  'tweaks',
  'optimizer-games',
]

function copyOptimizerPublic() {
  return {
    name: 'blank-optimizer-public',
    closeBundle() {
      const out = path.join(root, 'dist-optimizer')
      const pub = path.join(root, 'public')
      for (const item of publicFiles) {
        cpSync(path.join(pub, item), path.join(out, item), { recursive: true })
      }
    },
  }
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), copyOptimizerPublic()],
  build: {
    outDir: 'dist-optimizer',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        optimizer: fileURLToPath(new URL('./optimizer.html', import.meta.url)),
      },
    },
  },
})
