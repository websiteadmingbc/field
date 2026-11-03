import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served at the root of field.greatbrittongc.com, so base is '/'
export default defineConfig({
  plugins: [react()],
  base: '/',
})
