import { loader, type Monaco } from '@monaco-editor/react'
// @ts-expect-error Monaco only publishes declarations for its package root.
import * as monaco from '@monaco-editor-api'
import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'
import { configureMonacoYaml } from 'monaco-yaml'
import yamlWorker from 'monaco-yaml/yaml.worker?worker'
import '../../../node_modules/monaco-editor/esm/vs/editor/browser/coreCommands.js'
import '../../../node_modules/monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js'
import '../../../node_modules/monaco-editor/esm/vs/languages/definitions/yaml/register.js'

type MonacoWindow = typeof globalThis & {
  MonacoEnvironment?: { getWorker: (_moduleId: string, label: string) => Worker }
}

;(globalThis as MonacoWindow).MonacoEnvironment = {
  getWorker: (_moduleId, label) => label === 'yaml'
    ? new yamlWorker()
    : new editorWorker(),
}

loader.config({ monaco })

let yamlConfigured = false

export function configureYamlEditor(instance: Monaco) {
  if (yamlConfigured) return

  instance.editor.defineTheme('animpure-yaml', {
    base: 'vs-dark',
    inherit: true,
    colors: {
      'editor.background': '#171a1c',
      'editorCursor.foreground': '#ff8b68',
      'editor.selectionBackground': '#ff714d44',
      'editor.lineHighlightBackground': '#ffffff08',
    },
    rules: [
      { token: 'key', foreground: '8fb4ff' },
      { token: 'string', foreground: 'b8d99f' },
      { token: 'number', foreground: 'f0b27a' },
      { token: 'keyword', foreground: 'c3a6ff' },
      { token: 'comment', foreground: '697277' },
    ],
  })
  configureMonacoYaml(instance, {
    completion: false,
    enableSchemaRequest: false,
    format: { enable: false },
    hover: false,
    validate: false,
  })
  yamlConfigured = true
}
