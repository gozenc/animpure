import { loader, type Monaco } from '@monaco-editor/react'
import type { editor, languages } from 'monaco-editor'
// @ts-expect-error Monaco only publishes declarations for its package root.
import * as monaco from '@monaco-editor-api'
import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'
import { configureMonacoYaml } from 'monaco-yaml'
import yamlWorker from 'monaco-yaml/yaml.worker?worker'
import '../../../node_modules/monaco-editor/esm/vs/editor/browser/coreCommands.js'
import '../../../node_modules/monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js'
import '../../../node_modules/monaco-editor/esm/vs/editor/contrib/colorPicker/browser/colorPickerContribution.js'
import '../../../node_modules/monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js'
// @ts-expect-error Monaco does not publish declarations for its color utilities.
import { Color, RGBA } from '../../../node_modules/monaco-editor/esm/vs/base/common/color.js'
// @ts-expect-error Monaco does not publish declarations for its default color parser.
import { computeDefaultDocumentColors } from '../../../node_modules/monaco-editor/esm/vs/editor/common/languages/defaultDocumentColorsComputer.js'
// @ts-expect-error Monaco does not publish declarations for language definitions.
import { language as yamlLanguage } from '../../../node_modules/monaco-editor/esm/vs/languages/definitions/yaml/yaml.js'

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

const documentColors = (model: editor.ITextModel) => {
  const source = model.getValue()
  return computeDefaultDocumentColors({
    getValue: () => source,
    positionAt: (offset: number) => model.getPositionAt(offset),
    findMatches: (pattern: RegExp) => Array.from(source.matchAll(pattern)),
  })
}

export function configureYamlEditor(instance: Monaco) {
  if (yamlConfigured) return

  instance.editor.defineTheme('animpure-yaml', {
    base: 'vs-dark',
    inherit: true,
    colors: {
      'editor.background': '#171a1c',
      'editor.foreground': '#d7d3c8',
      'editorCursor.foreground': '#ff8b68',
      'editor.selectionBackground': '#ff714d44',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorLineNumber.foreground': '#565d61',
      'editorLineNumber.activeForeground': '#d7d3c8',
      'editorIndentGuide.background1': '#30363a',
      'editorIndentGuide.activeBackground1': '#596166',
    },
    rules: [
      { token: 'type', foreground: '8fb4ff' },
      { token: 'string', foreground: 'b8d99f' },
      { token: 'number', foreground: 'f0b27a' },
      { token: 'keyword', foreground: 'c3a6ff' },
      { token: 'operators', foreground: 'ff8b68' },
      { token: 'comment', foreground: '697277', fontStyle: 'italic' },
    ],
  })
  configureMonacoYaml(instance, {
    completion: false,
    enableSchemaRequest: false,
    format: { enable: false },
    hover: false,
    validate: false,
  })
  instance.languages.setMonarchTokensProvider('yaml', yamlLanguage)
  instance.languages.registerColorProvider('yaml', {
    provideDocumentColors: documentColors,
    provideColorPresentations: (
      _model: editor.ITextModel,
      { color, range }: languages.IColorInformation,
    ) => {
      const value = new Color(new RGBA(
        Math.round(color.red * 255),
        Math.round(color.green * 255),
        Math.round(color.blue * 255),
        color.alpha,
      ))
      return [
        Color.Format.CSS.formatRGB(value),
        Color.Format.CSS.formatHSL(value),
        Color.Format.CSS.formatHexA(value, true),
      ].map((text) => ({ label: text, textEdit: { range, text } }))
    },
  })
  yamlConfigured = true
}
