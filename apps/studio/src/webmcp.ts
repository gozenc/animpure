type ModelContextTool = {
  name: string
  description: string
  inputSchema: object
  execute: (input: Record<string, unknown>) => Promise<unknown>
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
}

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: ModelContextTool,
        options?: { signal?: AbortSignal },
      ) => Promise<void>
    }
  }
}

type StudioTools = {
  getYaml: () => string
  setYaml: (yaml: string) => string | undefined
  exportJpeg: () => Promise<{ fileName: string; width: number; height: number }>
  control: (input: { action?: unknown; time?: unknown; enabled?: unknown }) => unknown
}

export function registerStudioTools(tools: StudioTools) {
  if (!document.modelContext) return

  const controller = new AbortController()
  const stateSchema = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'stop', 'rewind', 'repeat', 'seek'] },
      enabled: { type: 'boolean', description: 'Required with repeat.' },
      time: { type: 'number', minimum: 0, description: 'Required with seek; seconds.' },
    },
    required: ['action'],
    allOf: [
      { if: { properties: { action: { const: 'repeat' } } }, then: { required: ['enabled'] } },
      { if: { properties: { action: { const: 'seek' } } }, then: { required: ['time'] } },
    ],
  }

  void Promise.all([
    document.modelContext.registerTool({
      name: 'edit_scene_yaml',
      description: 'Replace the Studio Monaco editor YAML. Returns the previous and resulting editor values, plus any validation error.',
      inputSchema: {
        type: 'object',
        properties: { yaml: { type: 'string', description: 'Complete scene YAML to put in the editor.' } },
        required: ['yaml'],
      },
      execute: async ({ yaml }) => {
        const previousYaml = tools.getYaml()
        const error = tools.setYaml(yaml as string)
        return { previousYaml, yaml, ...(error === undefined ? {} : { error }) }
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
    }, { signal: controller.signal }),
    document.modelContext.registerTool({
      name: 'scene_export',
      description: 'Rasterize the current scene frame to JPEG and download it in the browser.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => tools.exportJpeg(),
      annotations: { readOnlyHint: false },
    }, { signal: controller.signal }),
    document.modelContext.registerTool({
      name: 'control_panel',
      description: 'Control the Studio player: start, stop, rewind, enable or disable repeat, or seek its timeline range.',
      inputSchema: stateSchema,
      execute: async (input) => tools.control(input),
      annotations: { readOnlyHint: false },
    }, { signal: controller.signal }),
  ]).catch(() => {})

  return () => controller.abort()
}
