export type Point = { x: number; y: number }

export type Coordinate = {
  start: Point
  end?: Point
}

export type SceneObject = {
  id: string
  shape: 'rect' | 'ellipse'
  location: Point
  size: Point
  style: {
    fill?: string
    stroke?: string
    'stroke-width'?: number
    rounded?: number
  }
  group?: string
}

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

export type CompiledMoment = {
  id: string
  start: number
  end: number
  ease: string
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

const transition = (value: unknown, label: string) => {
  const coordinate = parseCoordinate(string(value, label))
  if (!coordinate.end) throw new SyntaxError(`${label} must contain ->`)
  return { start: coordinate.start, end: coordinate.end }
}

const compileStyle = (value: unknown, label: string) => {
  if (value === undefined) return {}

  const source = object(value, label)
  for (const key of Object.keys(source)) {
    if (key !== 'fill' && key !== 'stroke' && key !== 'stroke-width' && key !== 'rounded') {
      throw new RangeError(`Unsupported style: ${key}`)
    }
  }
  return {
    ...(source.fill === undefined ? {} : { fill: string(source.fill, `${label}.fill`) }),
    ...(source.stroke === undefined ? {} : { stroke: string(source.stroke, `${label}.stroke`) }),
    ...(source['stroke-width'] === undefined
      ? {}
      : { 'stroke-width': number(source['stroke-width'], `${label}.stroke-width`) }),
    ...(source.rounded === undefined ? {} : { rounded: number(source.rounded, `${label}.rounded`) }),
  }
}

export function compileScene(value: unknown): CompiledScene {
  const root = object(value, 'scene document')
  const settings = object(root.scene, 'scene')
  const maxTime = number(settings.max_time, 'scene.max_time')
  const precision = number(settings.precision, 'scene.precision')

  if (maxTime <= 0) throw new RangeError('scene.max_time must be greater than 0')
  if (precision <= 0) throw new RangeError('scene.precision must be greater than 0')

  const objectIds = new Set<string>()
  const objects = array(root.objects, 'objects').map((entry, index) => {
    const source = object(entry, `objects[${index}]`)
    const id = string(source.id, `objects[${index}].id`)
    const shape = string(source.shape, `objects[${index}].shape`)
    if (shape !== 'rect' && shape !== 'ellipse') {
      throw new RangeError(`Unsupported shape: ${shape}`)
    }
    if (objectIds.has(id)) throw new RangeError(`Duplicate object id: ${id}`)
    objectIds.add(id)

    return {
      id,
      shape,
      location: source.location === undefined
        ? { x: 0, y: 0 }
        : staticCoordinate(source.location, `${id}.location`),
      size: source.size === undefined
        ? { x: 0, y: 0 }
        : staticCoordinate(source.size, `${id}.size`),
      style: compileStyle(source.style, `${id}.style`),
      ...(source.group === undefined
        ? {}
        : { group: string(source.group, `${id}.group`) }),
    } satisfies SceneObject
  })

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
      if (start < 0 || end <= start || end > maxTime) {
        throw new RangeError(`Invalid time range for moment: ${momentId}`)
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
          throw new RangeError(`Unsupported operation: ${name}`)
        },
      )

      return {
        id: momentId,
        start,
        end,
        ease: moment.ease === undefined ? 'none' : string(moment.ease, `${momentId}.ease`),
        loop: moment.loop === undefined ? false : boolean(moment.loop, `${momentId}.loop`),
        zIndex: moment.z_index === undefined ? 0 : number(moment.z_index, `${momentId}.z_index`),
        operations,
      }
    })

    return { id, moments }
  })

  const writes = timelines.flatMap(({ moments }) => moments.flatMap((moment) =>
    moment.operations.map((operation) => ({
      objectId: operation.objectId,
      property: operation.name === 'move' ? 'location' : 'size',
      start: moment.start,
      end: moment.loop ? maxTime : moment.end,
      momentId: moment.id,
    })),
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
    objects,
    timelines,
  }
}
