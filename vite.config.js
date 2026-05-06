import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/shiyu-portfolio/',
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/.vs/**', '**/.vs/**/*']
    }
  }
})