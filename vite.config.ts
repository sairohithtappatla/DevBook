import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dev only: the same routes vercel.json proxies in production, so "Connect DevBook" (OAuth) and /mcp can be tested
// locally against a non-production InsForge project. Set DEVBOOK_FUNCTIONS_ORIGIN (e.g. https://<appkey>.function2.insforge.app)
// in your local env to enable it; that project's DEVBOOK_PUBLIC_ORIGIN secret must then be http://localhost:5173.
function functionProxy(functionsOrigin: string): Record<string, ProxyOptions> {
  const to = (target: string): ProxyOptions => ({ target: functionsOrigin, changeOrigin: true, rewrite: () => target })
  return {
    '^/mcp$': to('/devbook-mcp'),
    '^/\\.well-known/oauth-protected-resource(/mcp)?$': to('/devbook-oauth/.well-known/oauth-protected-resource'),
    '^/\\.well-known/oauth-authorization-server$': to('/devbook-oauth/.well-known/oauth-authorization-server'),
    '^/oauth/token$': to('/devbook-oauth/token'),
    '^/oauth/register$': to('/devbook-oauth/register'),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const functionsOrigin = loadEnv(mode, process.cwd(), '').DEVBOOK_FUNCTIONS_ORIGIN
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: functionsOrigin ? { proxy: functionProxy(functionsOrigin) } : undefined,
  }
})
