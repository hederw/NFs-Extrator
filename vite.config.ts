import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX: Replace `process.cwd()` with `''` to resolve the TypeScript error.
  // `loadEnv` will resolve the empty string to the current working directory.
  const env = loadEnv(mode, '', '')
  return {
    plugins: [react()],
    define: {
      // Expose all env variables to the client-side code for local development.
      // This allows `process.env.API_KEY` to be used in the browser.
      // In production, the platform handles environment variables differently.
      'process.env': env
    }
  }
})