import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const scenePath = fileURLToPath(new URL('../../.data/scene.contract.yaml', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: { exclude: ['@monaco-editor-api'] },
  resolve: {
    alias: {
      '@monaco-editor-api': fileURLToPath(
        new URL('../../node_modules/monaco-editor/esm/vs/editor/editor.api.js', import.meta.url),
      ),
      'monaco-editor/esm/vs/editor/editor.api.js': fileURLToPath(
        new URL('../../node_modules/monaco-editor/esm/vs/editor/editor.api.js', import.meta.url),
      ),
      'monaco-editor/esm/vs/editor/editor.worker': fileURLToPath(
        new URL('../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      ),
      'monaco-editor/esm/vs/editor/editor.worker.js': fileURLToPath(
        new URL('../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      ),
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'save-scene',
      configureServer(server) {
        server.middlewares.use('/api/scene', (request, response, next) => {
          if (request.method !== 'PUT') return next()
          let source = ''
          request.on('data', (chunk) => { source += chunk })
          request.on('end', () => {
            mkdirSync(fileURLToPath(new URL('../../.data', import.meta.url)), { recursive: true })
            writeFileSync(scenePath, source)
            response.statusCode = 204
            response.end()
          })
        })
      },
    },
  ],
})
