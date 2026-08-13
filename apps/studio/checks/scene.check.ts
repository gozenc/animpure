import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileScene, parseCoordinate } from '../src/engine/scene.ts'
import { segmentText } from '../src/engine/svg.ts'
import { compileYaml } from '../src/engine/yaml.ts'

assert.deepEqual(parseCoordinate('5'), { start: { x: 5, y: 5 } })
assert.deepEqual(parseCoordinate('0 5'), { start: { x: 0, y: 5 } })
assert.deepEqual(parseCoordinate('20 5 -> 0'), {
  start: { x: 20, y: 5 },
  end: { x: 0, y: 0 },
})

const scene = {
  name: 'check',
  scene: { unit: 'px', max_time: 10, precision: 1, size: '600 400' },
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
    },
  }],
}).objects[0]
assert.equal(textbox.style['line-height'], 1.2)
assert.equal(textbox.style['font-weight'], 600)
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

const contract = readFileSync(new URL('../../../docs/scene.contract.yaml', import.meta.url), 'utf8')
const compiledContract = compileYaml(contract)
assert.ok(compiledContract.objects.length > 0)
assert.deepEqual(segmentText('A👨‍👩‍👧‍👦B'), ['A', '👨‍👩‍👧‍👦', 'B'])
