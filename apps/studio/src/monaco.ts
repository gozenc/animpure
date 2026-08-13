import { loader, type Monaco } from '@monaco-editor/react'
// @ts-expect-error Monaco only publishes declarations for its package root.
import * as monaco from '@monaco-editor-api'
import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'
import { configureMonacoYaml } from 'monaco-yaml'
import yamlWorker from 'monaco-yaml/yaml.worker?worker'
import '../../../node_modules/monaco-editor/esm/vs/editor/browser/coreCommands.js'
import '../../../node_modules/monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js'

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

  configureMonacoYaml(instance, {
    completion: false,
    enableSchemaRequest: false,
    format: { enable: false },
    hover: false,
    validate: false,
  })
  yamlConfigured = true
}
