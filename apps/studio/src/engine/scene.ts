import { Eases } from './eases.ts'

export type Point = { x: number; y: number }
export type EaseName = keyof typeof Eases

export type Coordinate = {
  start: Point
  end?: Point
}

type ShapeStyle = {
  fill?: string
  stroke?: string
  'stroke-width'?: number
  'stroke-linecap'?: 'round' | 'butt'
  rounded?: number
}

type ShapeObject = {
  id: string
  position: Point
  size: Point
  style: ShapeStyle
  group?: string
} & ({ shape: 'rect' } | { shape: 'ellipse' })

export type PathObject = {
  id: string
  d: string
  origin: Point
  forks: { id: string; d: string; origin: Point }[]
  style: ShapeStyle
  group?: string
} & ({ shape: 'straight' } | { shape: 'curve' })

export type TextboxObject = {
  id: string
  shape: 'textbox'
  position: Point
  size: Point
  content: string
  style: ShapeStyle & {
    background?: string
    wrap: boolean
    'font-size': number
    'font-family': string
    'line-height'?: number
    'font-weight'?: number
  }
  group?: string
}

export type SceneObject = ShapeObject | PathObject | TextboxObject

export type CompiledOperation =
  | {
      name: 'move'
      objectId: string
      location: { start: Point; end: Point }
    }
  | {
      name: 'scale'
      objectId: string
      dimensions: { start: Point; end: Point }
      location?: Point
    }
  | {
      name: 'typewriter'
      objectId: string
    }
  | {
      name: 'font-resize'
      objectId: string
      size: { start: number; end: number }
    }
  | {
      name: 'draw'
      objectId: string
    }
  | {
      name: 'underline'
      objectId: string
      match: string
    }
  | {
      name: 'mark'
      objectId: string
      match: string
      backgroundColor: string
    }

export type CompiledMoment = {
  id: string
  start: number
  end: number
  ease: EaseName
  loop: boolean
  zIndex: number
  operations: CompiledOperation[]
}

export type CompiledScene = {
  name: string
  unit: string
  maxTime: number
  precision: number
  size: Point
  style: { background?: string }
  objects: SceneObject[]
  timelines: { id: string; moments: CompiledMoment[] }[]
}

const object = (value: unknown, label: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

const array = (value: unknown, label: string) => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`)
  return value
}

const string = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

const text = (value: unknown, label: string) => {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`)
  return value
}

const number = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
  return value
}

const boolean = (value: unknown, label: string) => {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean`)
  return value
}

const point = (value: string) => {
  const parts = value.trim().split(/\s+/)
  if (parts.length < 1 || parts.length > 2 || !parts[0]) {
    throw new SyntaxError(`Invalid coordinate: ${value}`)
  }

  const x = Number(parts[0])
  const y = parts.length === 1 ? x : Number(parts[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new SyntaxError(`Invalid coordinate: ${value}`)
  }
  return { x, y }
}

export function parseCoordinate(value: string): Coordinate {
  const parts = value.split('->')
  if (parts.length > 2) throw new SyntaxError(`Invalid coordinate: ${value}`)

  return {
    start: point(parts[0]),
    ...(parts[1] === undefined ? {} : { end: point(parts[1]) }),
  }
}

const staticCoordinate = (value: unknown, label: string) => {
  const coordinate = parseCoordinate(string(value, label))
  if (coordinate.end) throw new SyntaxError(`${label} cannot contain ->`)
  return coordinate.start
}

const pathPoint = ({ x, y }: Point) => `${x} ${y}`

const compileStraight = (value: unknown, label: string) => {
  const points = string(value, label).split('|').map(
    (entry, index) => staticCoordinate(entry.trim(), `${label}[${index}]`),
  )
  if (points.length < 2) throw new RangeError(`${label} requires at least two coordinates`)
  return {
    d: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${pathPoint(point)}`).join(' '),
    origin: points[0],
  }
}

const compileCurve = (value: unknown, label: string) => {
  const segments = array(value, label)
  if (segments.length < 2) throw new RangeError(`${label} requires a start and at least one segment`)

  const first = object(segments[0], `${label}[0]`)
  if (Object.keys(first).length !== 1 || !('start' in first)) {
    throw new SyntaxError(`${label} must start with start`)
  }
  const origin = staticCoordinate(first.start, `${label}[0].start`)
  const commands = segments.slice(1).map((entry, offset) => {
    const index = offset + 1
    const segment = object(entry, `${label}[${index}]`)
    const keys = Object.keys(segment)
    if (keys.length !== 1) throw new SyntaxError(`${label}[${index}] must contain one command`)

    const command = keys[0]
    if (command === 'line') {
      return `L ${pathPoint(staticCoordinate(segment.line, `${label}[${index}].line`))}`
    }
    if (command === 'curve') {
      const curve = object(segment.curve, `${label}[${index}].curve`)
      const curveKeys = Object.keys(curve)
      if (
        curveKeys.length !== 3
        || !['control-1', 'control-2', 'to'].every((key) => key in curve)
      ) {
        throw new SyntaxError(`${label}[${index}].curve requires control-1, control-2 and to`)
      }
      return `C ${[
        staticCoordinate(curve['control-1'], `${label}[${index}].curve.control-1`),
        staticCoordinate(curve['control-2'], `${label}[${index}].curve.control-2`),
        staticCoordinate(curve.to, `${label}[${index}].curve.to`),
      ].map(pathPoint).join(' ')}`
    }
    throw new RangeError(`Unsupported curve command: ${command}`)
  })
  return { d: [`M ${pathPoint(origin)}`, ...commands].join(' '), origin }
}

const compileForks = (value: unknown, label: string) => {
  if (value === undefined) return []

  const ids = new Set<string>()
  return array(value, label).map((entry, index) => {
    const fork = object(entry, `${label}[${index}]`)
    const id = string(fork.id, `${label}[${index}].id`)
    if (ids.has(id)) throw new RangeError(`Duplicate fork id: ${id}`)
    ids.add(id)
    for (const key of Object.keys(fork)) {
      if (key !== 'id' && key !== 'coords') throw new RangeError(`Unsupported fork field: ${key}`)
    }
    return { id, ...compileStraight(fork.coords, `${label}[${index}].coords`) }
  })
}

const transition = (value: unknown, label: string) => {
  const coordinate = parseCoordinate(string(value, label))
  if (!coordinate.end) throw new SyntaxError(`${label} must contain ->`)
  return { start: coordinate.start, end: coordinate.end }
}

const scalarTransition = (value: unknown, label: string) => {
  const source = string(value, label)
  const parts = source.split('->').map((part) => part.trim())
  if (parts.length !== 2 || parts.some((part) => !/^-?(?:\d+\.?\d*|\.\d+)$/.test(part))) {
    throw new SyntaxError(`${label} must contain two numbers separated by ->`)
  }
  return { start: Number(parts[0]), end: Number(parts[1]) }
}

const compileStyle = (value: unknown, label: string, shape: SceneObject['shape']) => {
  if (value === undefined) return {}

  const source = object(value, label)
  for (const key of Object.keys(source)) {
    if (
      key !== 'fill' && key !== 'stroke' && key !== 'stroke-width' && key !== 'rounded'
      && !((shape === 'straight' || shape === 'curve') && key === 'stroke-linecap')
      && !(shape === 'textbox' && (
        key === 'background' || key === 'wrap' || key === 'font-size' || key === 'font-family'
        || key === 'line-height' || key === 'font-weight'
      ))
    ) {
      throw new RangeError(`Unsupported style: ${key}`)
    }
  }
  const linecap = source['stroke-linecap']
  if (linecap !== undefined && linecap !== 'round' && linecap !== 'butt') {
    throw new RangeError(`${label}.stroke-linecap must be round or butt`)
  }
  return {
    ...(source.fill === undefined ? {} : { fill: string(source.fill, `${label}.fill`) }),
    ...(source.stroke === undefined ? {} : { stroke: string(source.stroke, `${label}.stroke`) }),
    ...(source['stroke-width'] === undefined
      ? {}
      : { 'stroke-width': number(source['stroke-width'], `${label}.stroke-width`) }),
    ...(linecap === undefined
      ? {}
      : { 'stroke-linecap': linecap as 'round' | 'butt' }),
    ...(source.rounded === undefined ? {} : { rounded: number(source.rounded, `${label}.rounded`) }),
    ...(source.background === undefined
      ? {}
      : { background: string(source.background, `${label}.background`) }),
    ...(source.wrap === undefined ? {} : { wrap: boolean(source.wrap, `${label}.wrap`) }),
    ...(source['font-size'] === undefined
      ? {}
      : { 'font-size': number(source['font-size'], `${label}.font-size`) }),
    ...(source['font-family'] === undefined
      ? {}
      : { 'font-family': string(source['font-family'], `${label}.font-family`) }),
    ...(source['line-height'] === undefined
      ? {}
      : { 'line-height': number(source['line-height'], `${label}.line-height`) }),
    ...(source['font-weight'] === undefined
      ? {}
      : { 'font-weight': number(source['font-weight'], `${label}.font-weight`) }),
  }
}

export function compileScene(value: unknown): CompiledScene {
  const root = object(value, 'scene document')
  const settings = object(root.scene, 'scene')
  const sceneStyle = settings.style === undefined ? {} : object(settings.style, 'scene.style')
  const maxTime = number(settings.max_time, 'scene.max_time')
  const precision = number(settings.precision, 'scene.precision')

  if (maxTime <= 0) throw new RangeError('scene.max_time must be greater than 0')
  if (precision <= 0) throw new RangeError('scene.precision must be greater than 0')

  const objectIds = new Set<string>()
  const objects = array(root.objects, 'objects').map((entry, index) => {
    const source = object(entry, `objects[${index}]`)
    const id = string(source.id, `objects[${index}].id`)
    const shape = string(source.shape, `objects[${index}].shape`)
    if (
      shape !== 'rect' && shape !== 'ellipse' && shape !== 'straight'
      && shape !== 'curve' && shape !== 'textbox'
    ) {
      throw new RangeError(`Unsupported shape: ${shape}`)
    }
    if (objectIds.has(id)) throw new RangeError(`Duplicate object id: ${id}`)
    objectIds.add(id)

    const base = {
      id,
      shape,
      position: source.position === undefined
        ? { x: 0, y: 0 }
        : staticCoordinate(source.position, `${id}.position`),
      size: source.size === undefined
        ? { x: 0, y: 0 }
        : staticCoordinate(source.size, `${id}.size`),
      style: compileStyle(source.style, `${id}.style`, shape),
      ...(source.group === undefined
        ? {}
        : { group: string(source.group, `${id}.group`) }),
    }

    if (shape === 'straight' || shape === 'curve') {
      if (shape === 'curve' && source.forks !== undefined) {
        throw new RangeError(`${id}.forks is only supported by straight`)
      }
      const geometry = shape === 'straight'
        ? compileStraight(source.coords, `${id}.coords`)
        : compileCurve(source.path, `${id}.path`)
      const forks = shape === 'straight' ? compileForks(source.forks, `${id}.forks`) : []
      for (const selector of [`${id}.main`, ...forks.map((fork) => `${id}.${fork.id}`)]) {
        if (objectIds.has(selector)) throw new RangeError(`Duplicate object id: ${selector}`)
        objectIds.add(selector)
      }
      return {
        id,
        shape,
        ...geometry,
        forks,
        style: base.style,
        ...(base.group === undefined ? {} : { group: base.group }),
      } satisfies PathObject
    }
    if (shape !== 'textbox') return base as ShapeObject
    if (source.size === undefined) throw new TypeError(`${id}.size is required`)
    const style = base.style as TextboxObject['style']
    if (style.wrap === undefined) throw new TypeError(`${id}.style.wrap is required`)
    if (style['font-size'] === undefined) throw new TypeError(`${id}.style.font-size is required`)
    if (style['font-family'] === undefined) throw new TypeError(`${id}.style.font-family is required`)
    return {
      ...base,
      shape: 'textbox',
      content: text(source.content, `${id}.content`),
      style,
    } satisfies TextboxObject
  })

  const shapesById = new Map(objects.flatMap((object) => [
    [object.id, object.shape] as const,
    ...(object.shape === 'straight' || object.shape === 'curve'
      ? [
          [`${object.id}.main`, object.shape] as const,
          ...object.forks.map((fork) => [`${object.id}.${fork.id}`, object.shape] as const),
        ]
      : []),
  ]))
  const objectsById = new Map(objects.map((object) => [object.id, object]))

  const momentIds = new Set<string>()
  const timelines = array(root.timelines, 'timelines').map((entry, timelineIndex) => {
    const source = object(entry, `timelines[${timelineIndex}]`)
    const id = string(source.id, `timelines[${timelineIndex}].id`)
    const moments = array(source.moments, `${id}.moments`).map((entry, momentIndex) => {
      const moment = object(entry, `${id}.moments[${momentIndex}]`)
      const momentId = string(moment.id, `${id}.moments[${momentIndex}].id`)
      if (momentIds.has(momentId)) throw new RangeError(`Duplicate moment id: ${momentId}`)
      momentIds.add(momentId)

      const start = number(moment.start, `${momentId}.start`)
      const end = number(moment.end, `${momentId}.end`)
      const ease = moment.ease === undefined ? 'none' : string(moment.ease, `${momentId}.ease`)
      if (start < 0 || end <= start || end > maxTime) {
        throw new RangeError(`Invalid time range for moment: ${momentId}`)
      }
      if (!(ease in Eases)) {
        throw new RangeError(`Unsupported ease: ${ease}. Supported: ${Object.keys(Eases).join(', ')}`)
      }

      const operations = array(moment.operations, `${momentId}.operations`).map(
        (entry, operationIndex): CompiledOperation => {
          const operation = object(entry, `${momentId}.operations[${operationIndex}]`)
          const name = string(operation.name, `${momentId}.operations[${operationIndex}].name`)
          const objectId = string(operation.select, `${momentId}.operations[${operationIndex}].select`)
          if (!objectIds.has(objectId)) throw new RangeError(`Unknown object: ${objectId}`)

          if (name === 'move') {
            return {
              name,
              objectId,
              location: transition(operation.location, `${momentId}.location`),
            }
          }
          if (name === 'scale') {
            return {
              name,
              objectId,
              dimensions: transition(operation.dimensions, `${momentId}.dimensions`),
              ...(operation.location === undefined
                ? {}
                : { location: staticCoordinate(operation.location, `${momentId}.location`) }),
            }
          }
          if (name === 'typewriter' || name === 'font-resize') {
            if (shapesById.get(objectId)! !== 'textbox') {
              throw new RangeError(`${name} requires a textbox: ${objectId}`)
            }
            return name === 'typewriter'
              ? { name, objectId }
              : {
                  name,
                  objectId,
                  size: scalarTransition(operation.size, `${momentId}.size`),
                }
          }
          if (name === 'draw') {
            const shape = shapesById.get(objectId)!
            if (shape !== 'straight' && shape !== 'curve') {
              throw new RangeError(`draw requires a straight or curve: ${objectId}`)
            }
            return { name, objectId }
          }
          if (name === 'underline' || name === 'mark') {
            const selected = objectsById.get(objectId)!
            if (selected.shape !== 'textbox') {
              throw new RangeError(`${name} requires a textbox: ${objectId}`)
            }
            const match = string(operation.match, `${momentId}.match`)
            if (!selected.content.includes(match)) {
              throw new RangeError(`Text not found in ${objectId}: ${match}`)
            }
            return name === 'underline'
              ? { name, objectId, match }
              : {
                  name,
                  objectId,
                  match,
                  backgroundColor: string(
                    operation['background-color'],
                    `${momentId}.background-color`,
                  ),
                }
          }
          throw new RangeError(`Unsupported operation: ${name}`)
        },
      )

      return {
        id: momentId,
        start,
        end,
        ease: ease as EaseName,
        loop: moment.loop === undefined ? false : boolean(moment.loop, `${momentId}.loop`),
        zIndex: moment.z_index === undefined ? 0 : number(moment.z_index, `${momentId}.z_index`),
        operations,
      }
    })

    return { id, moments }
  })

  const drawTargets = new Map(objects.flatMap((object) =>
    object.shape === 'straight' || object.shape === 'curve'
      ? [[object.id, [
          `${object.id}.main`,
          ...object.forks.map((fork) => `${object.id}.${fork.id}`),
        ]] as const]
      : [],
  ))
  const writes = timelines.flatMap(({ moments }) => moments.flatMap((moment) =>
    moment.operations.flatMap((operation) =>
      (operation.name === 'draw'
        ? drawTargets.get(operation.objectId) ?? [operation.objectId]
        : [operation.objectId]
      ).map((objectId) => ({
        objectId,
        property: operation.name === 'move'
          ? 'location'
          : operation.name === 'draw'
            ? 'stroke-dashoffset'
            : operation.name === 'typewriter'
              ? 'content'
            : operation.name === 'font-resize'
                ? 'font-size'
                : operation.name === 'underline'
                  ? `underline:${operation.match}`
                  : operation.name === 'mark'
                    ? `mark:${operation.match}`
                  : 'size',
        start: moment.start,
        end: moment.loop ? maxTime : moment.end,
        momentId: moment.id,
      })),
    ),
  ))

  for (let index = 0; index < writes.length; index += 1) {
    const current = writes[index]
    const conflict = writes.slice(index + 1).find((candidate) =>
      candidate.objectId === current.objectId
      && candidate.property === current.property
      && current.start < candidate.end
      && candidate.start < current.end,
    )
    if (conflict) {
      throw new RangeError(`Conflicting moments: ${current.momentId}, ${conflict.momentId}`)
    }
  }

  return {
    name: string(root.name, 'name'),
    unit: string(settings.unit, 'scene.unit'),
    maxTime,
    precision,
    size: staticCoordinate(settings.size, 'scene.size'),
    style: {
      ...(sceneStyle.background === undefined
        ? {}
        : { background: string(sceneStyle.background, 'scene.style.background') }),
    },
    objects,
    timelines,
  }
}
