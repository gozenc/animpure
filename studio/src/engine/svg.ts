import { SVG, Timeline, type Shape } from '@svgdotjs/svg.js'
import type { CompiledScene } from './scene.ts'

const eases: Record<string, (time: number) => number> = {
  none: (time) => time,
  inOutCubic: (time) => time < 0.5
    ? 4 * time * time * time
    : 1 - Math.pow(-2 * time + 2, 3) / 2,
}

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

  const elements = new Map<string, Shape>()
  for (const object of [...scene.objects].sort(
    (left, right) => layers.get(left.id)! - layers.get(right.id)!,
  )) {
    const element = object.shape === 'rect'
      ? draw.rect(object.size.x, object.size.y)
      : draw.ellipse(object.size.x, object.size.y)

    element
      .timeline(timeline)
      .move(object.location.x, object.location.y)
      .attr('data-object-id', object.id)
    if (object.style.fill !== undefined) element.fill(object.style.fill)
    if (object.style.stroke !== undefined) element.stroke(object.style.stroke)
    if (object.style['stroke-width'] !== undefined) {
      element.attr('stroke-width', object.style['stroke-width'])
    }
    if (object.shape === 'rect' && object.style.rounded !== undefined) {
      element.radius(object.style.rounded)
    }
    elements.set(object.id, element)
  }

  for (const { moments } of scene.timelines) {
    for (const moment of moments) {
      const ease = eases[moment.ease]
      if (!ease) throw new RangeError(`Unsupported ease: ${moment.ease}`)

      for (const operation of moment.operations) {
        const element = elements.get(operation.objectId)!
        const duration = (moment.end - moment.start) * 1000
        const runner = element.animate(duration, moment.start * 1000, 'absolute').ease(ease)

        if (operation.name === 'move') {
          element.move(operation.location.start.x, operation.location.start.y)
          runner.move(operation.location.end.x, operation.location.end.y)
        } else {
          element.size(operation.dimensions.start.x, operation.dimensions.start.y)
          if (operation.location) element.move(operation.location.x, operation.location.y)
          runner.size(operation.dimensions.end.x, operation.dimensions.end.y)
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
