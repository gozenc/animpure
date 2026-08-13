import { SVG, Timeline } from '@svgdotjs/svg.js'

const near = (actual: number, expected: number) => {
  if (Math.abs(actual - expected) > 0.01) {
    throw new Error(`SVG.js timeline: expected ${expected}, got ${actual}`)
  }
}

export function runSvgJsSpike() {
  const host = document.body.appendChild(document.createElement('div'))
  host.hidden = true

  const draw = SVG().addTo(host).size(200, 100)
  const timeline = new Timeline().persist(true).pause().time(0)
  const once = draw.rect(10, 10).timeline(timeline)
  const loop = draw.rect(10, 10).timeline(timeline)

  once.animate(1000, 0, 'absolute').ease('-').move(100, 0)
  loop.animate(1000, 0, 'absolute').ease('-').move(100, 20).loop()

  for (const [time, onceX, loopX] of [
    [2500, 100, 50],
    [0, 0, 0],
    [1500, 100, 50],
    [500, 50, 50],
  ]) {
    timeline.time(time)
    near(Number(once.x()), onceX)
    near(Number(loop.x()), loopX)
  }

  timeline.terminate()
  draw.remove()
  host.remove()
}
