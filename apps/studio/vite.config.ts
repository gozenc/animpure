import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
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
    babel({ presets: [reactCompilerPreset()] })
  ],
})
