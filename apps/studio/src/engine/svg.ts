import { SVG, Timeline, type Element, type G } from '@svgdotjs/svg.js'
import { Eases } from './eases.ts'
import type { CompiledScene, Point, SceneObject } from './scene.ts'

export const segmentText = (content: string) => Array.from(
  new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content),
  ({ segment }) => segment,
)

const applyStyle = (element: Element, style: SceneObject['style']) => {
  if (style.fill !== undefined) element.fill(style.fill)
  if (style.stroke !== undefined) element.stroke(style.stroke)
  if (style['stroke-width'] !== undefined) element.attr('stroke-width', style['stroke-width'])
  if (style['stroke-linecap'] !== undefined) element.attr('stroke-linecap', style['stroke-linecap'])
}

const measureTextMatch = (node: HTMLElement, match: string, size: Point) => {
  const start = node.textContent!.indexOf(match)
  if (start === -1) return []

  const range = document.createRange()
  range.setStart(node.firstChild!, start)
  range.setEnd(node.firstChild!, start + match.length)
  const bounds = node.getBoundingClientRect()
  const scaleX = size.x / bounds.width
  const scaleY = size.y / bounds.height
  return Array.from(range.getClientRects(), (rect) => ({
    x: (rect.left - bounds.left) * scaleX,
    y: (rect.top - bounds.top) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }))
}

export function mountScene(container: HTMLElement, scene: CompiledScene) {
  container.replaceChildren()

  const draw = SVG()
    .addTo(container)
    .size('100%', '100%')
    .viewbox(0, 0, scene.size.x, scene.size.y)
  const timeline = new Timeline(() => 0).persist(true).pause().time(0)
  const layers = new Map(scene.objects.map((object) => [object.id, 0]))
  const owners = new Map<string, string>()
  for (const object of scene.objects) {
    if (object.shape !== 'straight' && object.shape !== 'curve') continue
    owners.set(`${object.id}.main`, object.id)
    for (const fork of object.forks) owners.set(`${object.id}.${fork.id}`, object.id)
  }

  // ponytail: layers are static; evaluate z-index per frame if animated layering becomes necessary.
  for (const { moments } of scene.timelines) {
    for (const moment of moments) {
      for (const operation of moment.operations) {
        const objectId = owners.get(operation.objectId) ?? operation.objectId
        layers.set(objectId, Math.max(layers.get(objectId)!, moment.zIndex))
      }
    }
  }

  const elements = new Map<string, Element>()
  const paths = new Map<string, { element: Element; length: number }[]>()
  const pathOrigins = new Map<string, Point>()
  const textboxes = new Map<string, {
    element: G
    node: HTMLElement
    graphemes: string[]
    size: Point
  }>()
  for (const object of [...scene.objects].sort(
    (left, right) => layers.get(left.id)! - layers.get(right.id)!,
  )) {
    if (object.shape === 'textbox') {
      const element = draw.group()
      const foreignObject = element.foreignObject(object.size.x, object.size.y)
      const node = document.createElementNS('http://www.w3.org/1999/xhtml', 'div')
      node.textContent = object.content
      node.style.cssText = [
        'width:100%',
        'height:100%',
        'overflow:hidden',
        `white-space:${object.style.wrap ? 'normal' : 'nowrap'}`,
        `font-size:${object.style['font-size']}px`,
        `font-family:${object.style['font-family']}`,
        ...(object.style['line-height'] === undefined ? [] : [`line-height:${object.style['line-height']}`]),
        ...(object.style['font-weight'] === undefined ? [] : [`font-weight:${object.style['font-weight']}`]),
        ...(object.style.fill === undefined ? [] : [`color:${object.style.fill}`]),
      ].join(';')
      foreignObject.node.append(node)
      element
        .clipWith(draw.rect(object.size.x, object.size.y))
        .timeline(timeline)
        .transform({ translate: [object.position.x, object.position.y] })
        .attr('data-object-id', object.id)
      elements.set(object.id, element)
      textboxes.set(object.id, {
        element,
        node,
        graphemes: segmentText(object.content),
        size: object.size,
      })
      continue
    }

    if (object.shape === 'straight' || object.shape === 'curve') {
      const group = draw.group()
        .timeline(timeline)
        .attr('data-object-id', object.id)
      const parts = [
        { id: `${object.id}.main`, d: object.d, origin: object.origin },
        ...object.forks.map(({ id, ...fork }) => ({ id: `${object.id}.${id}`, ...fork })),
      ]
      const groupPaths = parts.map((part) => {
        const path = group.path(part.d)
          .timeline(timeline)
          .attr('data-object-id', part.id)
        applyStyle(path, object.style)
        const animatedPath = { element: path as Element, length: path.length() }
        elements.set(part.id, path)
        paths.set(part.id, [animatedPath])
        pathOrigins.set(part.id, part.origin)
        return animatedPath
      })
      elements.set(object.id, group)
      paths.set(object.id, groupPaths)
      pathOrigins.set(object.id, object.origin)
      continue
    }

    let element: Element
    if (object.shape === 'rect') {
      const rect = draw.rect(object.size.x, object.size.y)
      if (object.style.rounded !== undefined) rect.radius(object.style.rounded)
      element = rect
    } else {
      element = draw.ellipse(object.size.x, object.size.y)
    }

    element
      .timeline(timeline)
      .attr('data-object-id', object.id)
    if (object.shape === 'rect' || object.shape === 'ellipse') {
      element.move(object.position.x, object.position.y)
    }
    applyStyle(element, object.style)
    elements.set(object.id, element)
  }

  for (const { moments } of scene.timelines) {
    for (const moment of moments) {
      const ease = Eases[moment.ease]

      for (const operation of moment.operations) {
        const duration = (moment.end - moment.start) * 1000
        if (operation.name === 'draw') {
          for (const path of paths.get(operation.objectId)!) {
            path.element.attr({
              'stroke-dasharray': path.length,
              'stroke-dashoffset': path.length,
            })
            const runner = path.element
              .animate(duration, moment.start * 1000, 'absolute')
              .ease(ease)
              .attr({ 'stroke-dashoffset': 0 })
            if (moment.loop) runner.loop()
          }
          continue
        }

        const element = elements.get(operation.objectId)!
        const runner = element.animate(duration, moment.start * 1000, 'absolute').ease(ease)

        if (operation.name === 'move') {
          if (textboxes.has(operation.objectId)) {
            element.transform({
              translate: [operation.location.start.x, operation.location.start.y],
            })
            runner.transform({
              translate: [operation.location.end.x, operation.location.end.y],
            })
          } else if (pathOrigins.has(operation.objectId)) {
            const origin = pathOrigins.get(operation.objectId)!
            element.transform({
              translate: [
                operation.location.start.x - origin.x,
                operation.location.start.y - origin.y,
              ],
            })
            runner.transform({
              translate: [
                operation.location.end.x - origin.x,
                operation.location.end.y - origin.y,
              ],
            })
          } else {
            element.move(operation.location.start.x, operation.location.start.y)
            runner.move(operation.location.end.x, operation.location.end.y)
          }
        } else if (operation.name === 'scale') {
          element.size(operation.dimensions.start.x, operation.dimensions.start.y)
          if (operation.location) element.move(operation.location.x, operation.location.y)
          runner.size(operation.dimensions.end.x, operation.dimensions.end.y)
        } else if (operation.name === 'typewriter') {
          const textbox = textboxes.get(operation.objectId)!
          textbox.node.textContent = ''
          runner.during((position: number) => {
            textbox.node.textContent = textbox.graphemes
              .slice(0, Math.floor(textbox.graphemes.length * ease(position)))
              .join('')
          })
        } else if (operation.name === 'font-resize') {
          const textbox = textboxes.get(operation.objectId)!
          textbox.node.style.fontSize = `${operation.size.start}px`
          runner.during((position: number) => {
            const progress = ease(position)
            textbox.node.style.fontSize = `${operation.size.start
              + (operation.size.end - operation.size.start) * progress}px`
          })
        } else if (operation.name === 'underline') {
          const textbox = textboxes.get(operation.objectId)!
          const lines: Element[] = []
          runner.during((position: number) => {
            for (const line of lines) line.attr('visibility', 'hidden')
            const progress = ease(position)
            if (progress <= 0) return
            const rects = measureTextMatch(textbox.node, operation.match, textbox.size)
            rects.forEach((rect, index) => {
              const thickness = Math.max(1, rect.height / 12)
              const line = lines[index] ?? textbox.element.line(0, 0, 0, 0)
                .attr({
                  'data-underline': operation.match,
                  stroke: getComputedStyle(textbox.node).color,
                  'stroke-linecap': 'round',
                })
              lines[index] = line
              line.attr({
                visibility: 'visible',
                'stroke-width': thickness,
                x1: rect.x,
                y1: rect.y + rect.height - thickness / 2,
                x2: rect.x + rect.width * progress,
                y2: rect.y + rect.height - thickness / 2,
              })
            })
          })
        } else if (operation.name === 'mark') {
          const textbox = textboxes.get(operation.objectId)!
          const marks: Element[] = []
          runner.during((position: number) => {
            const rects = measureTextMatch(textbox.node, operation.match, textbox.size)
            for (const mark of marks) mark.attr('visibility', 'hidden')
            const progress = ease(position)
            rects.forEach((rect, index) => {
              const mark = marks[index] ?? textbox.element.rect(0, 0)
                .attr({
                  'data-mark': operation.match,
                  fill: operation.backgroundColor,
                })
                .back()
              marks[index] = mark
              mark.attr({
                visibility: 'visible',
                x: rect.x,
                y: rect.y,
                width: rect.width * progress,
                height: rect.height,
              })
            })
          })
        }
        if (moment.loop) runner.loop()
      }
    }
  }

  timeline.pause().time(0)

  return {
    draw,
    timeline,
    time: (seconds: number) => timeline.time(seconds * 1000),
    pause: () => timeline.pause(),
    destroy: () => {
      timeline.terminate()
      draw.remove()
    },
  }
}
