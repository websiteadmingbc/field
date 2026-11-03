import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served at the root of field.greatbrittongc.com
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
})
