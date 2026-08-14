import type { CompiledScene } from './scene.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'

export async function exportSceneJpeg(svg: SVGSVGElement, scene: CompiledScene) {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const originals = svg.querySelectorAll('foreignObject')
  copy.querySelectorAll('foreignObject').forEach((foreignObject, index) => {
    const source = originals[index].querySelector('div')!
    const style = getComputedStyle(source)
    const text = document.createElementNS(svgNamespace, 'text')
    text.textContent = source.textContent
    text.setAttribute('fill', style.color)
    text.setAttribute('font-family', style.fontFamily)
    text.setAttribute('font-size', style.fontSize)
    text.setAttribute('font-weight', style.fontWeight)
    text.setAttribute('dominant-baseline', 'hanging')
    foreignObject.replaceWith(text)
  })
  copy.setAttribute('width', String(scene.size.x))
  copy.setAttribute('height', String(scene.size.y))

  const imageUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], {
    type: 'image/svg+xml',
  }))
  const image = new Image()
  image.src = imageUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = scene.size.x
  canvas.height = scene.size.y
  const context = canvas.getContext('2d')!
  context.fillStyle = scene.style.background ?? '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(imageUrl)

  const fileName = `${scene.name}.jpg`
  return {
    fileName,
    mimeType: 'image/jpeg',
    width: canvas.width,
    height: canvas.height,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
  }
}
