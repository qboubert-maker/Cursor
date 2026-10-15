import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    outDir: 'dist-keyboard',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        keyboard: fileURLToPath(new URL('./keyboard.html', import.meta.url)),
      },
    },
  },
})
