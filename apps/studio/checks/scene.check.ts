import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileScene, parseCoordinate } from '../src/engine/scene.ts'
import { segmentText } from '../src/engine/svg.ts'
import { compileYaml } from '../src/engine/yaml.ts'
import { registerStudioTools } from '../src/webmcp.ts'

assert.deepEqual(parseCoordinate('5'), { start: { x: 5, y: 5 } })
assert.deepEqual(parseCoordinate('0 5'), { start: { x: 0, y: 5 } })
assert.deepEqual(parseCoordinate('20 5 -> 0'), {
  start: { x: 20, y: 5 },
  end: { x: 0, y: 0 },
})

const scene = {
  name: 'check',
  scene: {
    unit: 'px',
    max_time: 10,
    precision: 1,
    size: '600 400',
    style: { background: '#F5F5F5' },
  },
  objects: [{ id: 'box', shape: 'rect', size: '10', position: '3 4' }],
  timelines: [{
    id: 'main',
    moments: [{
      id: 'move-box',
      start: 0,
      end: 1,
      operations: [{ name: 'move', select: 'box', location: '0 -> 10 20' }],
    }],
  }],
}

assert.deepEqual(compileScene(scene).objects[0].size, { x: 10, y: 10 })
assert.deepEqual(compileScene(scene).objects[0].position, { x: 3, y: 4 })
assert.equal(compileScene(scene).style.background, '#F5F5F5')
const textbox = compileScene({
  ...scene,
  timelines: [],
  objects: [{
    id: 'text',
    shape: 'textbox',
    size: '10',
    content: 'check',
    style: {
      wrap: true,
      'font-size': 12,
      'font-family': 'SFUI',
      'line-height': 1.2,
      'font-weight': 600,
      background: '#FFFFFF',
      stroke: '#008080',
      'stroke-width': 2,
    },
  }],
}).objects[0]
assert.equal(textbox.shape, 'textbox')
if (textbox.shape !== 'textbox') throw new Error('Expected textbox')
assert.equal(textbox.style['line-height'], 1.2)
assert.equal(textbox.style['font-weight'], 600)
assert.equal(textbox.style.background, '#FFFFFF')
assert.equal(textbox.style.stroke, '#008080')
const underline = compileScene({
  ...scene,
  objects: [{
    id: 'text',
    shape: 'textbox',
    size: '200 100',
    content: 'capital preservation',
    style: { wrap: true, 'font-size': 12, 'font-family': 'SFUI' },
  }],
  timelines: [{
    id: 'main',
    moments: [{
      id: 'underline-text',
      start: 0,
      end: 1,
      operations: [{
        name: 'underline',
        select: 'text',
        match: 'capital preservation',
        style: { color: '#008080', 'stroke-width': 3, 'stroke-linecap': 'butt' },
      }],
    }],
  }],
}).timelines[0].moments[0].operations[0]
assert.equal(underline.name, 'underline')
if (underline.name !== 'underline') throw new Error('Expected underline')
assert.equal(underline.match, 'capital preservation')
assert.deepEqual(underline.style, {
  color: '#008080',
  'stroke-width': 3,
  'stroke-linecap': 'butt',
})
const mark = compileScene({
  ...scene,
  objects: [{
    id: 'text',
    shape: 'textbox',
    size: '200 100',
    content: 'capital preservation',
    style: { wrap: true, 'font-size': 12, 'font-family': 'SFUI' },
  }],
  timelines: [{
    id: 'main',
    moments: [{
      id: 'mark-text',
      start: 0,
      end: 1,
      operations: [{
        name: 'mark',
        select: 'text',
        match: 'capital preservation',
        style: {
          color: '#FFFFFF',
          'background-color': '#FFC517',
          transition: 'color',
        },
      }],
    }],
  }],
}).timelines[0].moments[0].operations[0]
assert.equal(mark.name, 'mark')
if (mark.name !== 'mark') throw new Error('Expected mark')
assert.equal(mark.style.backgroundColor, '#FFC517')
assert.equal(mark.style.color, '#FFFFFF')
assert.equal(mark.style.transition, 'color')
const straightScene = compileScene({
  ...scene,
  objects: [{
    id: 'wire',
    shape: 'straight',
    coords: '300 295 | 300 400 | 400 400',
    forks: [{ id: 'fork_1', coords: '400 400 | 450 400' }],
    style: { stroke: '#008080', 'stroke-width': 5, 'stroke-linecap': 'round' },
  }],
  timelines: [{
    id: 'main',
    moments: [{
      id: 'draw-wire',
      start: 0,
      end: 1,
      operations: [{ name: 'draw', select: 'wire.fork_1' }],
    }],
  }],
})
assert.equal(straightScene.objects[0].shape, 'straight')
if (straightScene.objects[0].shape !== 'straight') throw new Error('Expected straight')
assert.equal(straightScene.objects[0].d, 'M 300 295 L 300 400 L 400 400')
assert.deepEqual(straightScene.objects[0].origin, { x: 300, y: 295 })
assert.equal(straightScene.objects[0].forks[0].d, 'M 400 400 L 450 400')
assert.equal(straightScene.objects[0].style['stroke-linecap'], 'round')
assert.equal(straightScene.timelines[0].moments[0].operations[0].name, 'draw')
assert.equal(straightScene.timelines[0].moments[0].operations[0].objectId, 'wire.fork_1')
const curve = compileScene({
  ...scene,
  timelines: [],
  objects: [{
    id: 'curve',
    shape: 'curve',
    path: [
      { start: '0' },
      { line: '0 120' },
      { curve: { 'control-1': '0 180', 'control-2': '60 220', to: '120 220' } },
    ],
  }],
}).objects[0]
assert.equal(curve.shape, 'curve')
if (curve.shape !== 'curve') throw new Error('Expected curve')
assert.equal(curve.d, 'M 0 0 L 0 120 C 0 180 60 220 120 220')
assert.throws(() => compileScene({
  ...scene,
  timelines: [],
  objects: [{
    id: 'wire',
    shape: 'straight',
    coords: '0 | 10',
    style: { 'stroke-linecap': 'bump' },
  }],
}), /must be round or butt/)
assert.throws(() => compileScene({
  ...scene,
  timelines: [{
    id: 'main',
    moments: [scene.timelines[0].moments[0], {
      ...scene.timelines[0].moments[0],
      id: 'conflict',
      start: 0.5,
      end: 2,
    }],
  }],
}), /Conflicting moments/)
assert.equal(compileScene({
  ...scene,
  timelines: [{
    ...scene.timelines[0],
    moments: [{ ...scene.timelines[0].moments[0], ease: 'inOutQuad' }],
  }],
}).timelines[0].moments[0].ease, 'inOutQuad')
assert.throws(() => compileScene({
  ...scene,
  timelines: [{
    ...scene.timelines[0],
    moments: [{ ...scene.timelines[0].moments[0], ease: 'inOutSine' }],
  }],
}), /Supported: none, inQuad/)

const contract = readFileSync(new URL('../../../.data/scene.contract.yaml', import.meta.url), 'utf8')
const compiledContract = compileYaml(contract)
assert.ok(compiledContract.objects.length > 0)
assert.deepEqual(segmentText('A👨‍👩‍👧‍👦B'), ['A', '👨‍👩‍👧‍👦', 'B'])

const registered: { name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }[] = []
Object.assign(globalThis, {
  document: {
    modelContext: {
      registerTool: async (tool: { name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }) => {
        registered.push(tool)
      },
    },
  },
})
const unregister = registerStudioTools({
  getYaml: () => 'before',
  setYaml: (yaml) => yaml === 'broken' ? 'invalid YAML' : undefined,
  exportJpeg: async () => ({
    fileName: 'scene.jpg',
    mimeType: 'image/jpeg',
    width: 600,
    height: 400,
    dataUrl: 'data:image/jpeg;base64,',
  }),
  control: ({ action }) => ({ action }),
})
await new Promise(queueMicrotask)
assert.deepEqual(registered.map(({ name }) => name), ['edit_scene_yaml', 'scene_export', 'control_panel'])
assert.deepEqual(await registered[0].execute({ yaml: 'broken' }), {
  previousYaml: 'before', yaml: 'broken', error: 'invalid YAML',
})
assert.deepEqual(await registered[2].execute({ action: 'rewind' }), { action: 'rewind' })
unregister?.()
