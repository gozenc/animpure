import { SVG, Timeline, type Element } from '@svgdotjs/svg.js'
import { Eases } from './eases.ts'
import type { CompiledScene } from './scene.ts'

export const segmentText = (content: string) => Array.from(
  new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content),
  ({ segment }) => segment,
)

export function mountScene(container: HTMLElement, scene: CompiledScene) {
  container.replaceChildren()

  const draw = SVG()
    .addTo(container)
    .size('100%', '100%')
    .viewbox(0, 0, scene.size.x, scene.size.y)
  const timeline = new Timeline(() => 0).persist(true).pause().time(0)
  const layers = new Map(scene.objects.map((object) => [object.id, 0]))

  // ponytail: layers are static; evaluate z-index per frame if animated layering becomes necessary.
  for (const { moments } of scene.timelines) {
    for (const moment of moments) {
      for (const operation of moment.operations) {
        layers.set(operation.objectId, Math.max(layers.get(operation.objectId)!, moment.zIndex))
      }
    }
  }

  const elements = new Map<string, Element>()
  const paths = new Map<string, number>()
  const textboxes = new Map<string, { node: HTMLElement; graphemes: string[] }>()
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
      textboxes.set(object.id, { node, graphemes: segmentText(object.content) })
      continue
    }

    let element: Element
    if (object.shape === 'straight' || object.shape === 'curve') {
      const path = draw.path(object.d)
      paths.set(object.id, path.length())
      element = path
    } else if (object.shape === 'rect') {
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
    if (object.style.fill !== undefined) element.fill(object.style.fill)
    if (object.style.stroke !== undefined) element.stroke(object.style.stroke)
    if (object.style['stroke-width'] !== undefined) {
      element.attr('stroke-width', object.style['stroke-width'])
    }
    if (object.style['stroke-linecap'] !== undefined) {
      element.attr('stroke-linecap', object.style['stroke-linecap'])
    }
    elements.set(object.id, element)
  }

  for (const { moments } of scene.timelines) {
    for (const moment of moments) {
      const ease = Eases[moment.ease]

      for (const operation of moment.operations) {
        const element = elements.get(operation.objectId)!
        const duration = (moment.end - moment.start) * 1000
        const runner = element.animate(duration, moment.start * 1000, 'absolute').ease(ease)

        if (operation.name === 'move') {
          if (textboxes.has(operation.objectId)) {
            element.transform({
              translate: [operation.location.start.x, operation.location.start.y],
            })
            runner.transform({
              translate: [operation.location.end.x, operation.location.end.y],
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
        } else {
          const length = paths.get(operation.objectId)!
          element.attr({ 'stroke-dasharray': length, 'stroke-dashoffset': length })
          runner.attr({ 'stroke-dashoffset': 0 })
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
