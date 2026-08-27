import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative assets keep the static build working at a custom domain or a repository subpath.
  base: './',
  plugins: [react()],
})
