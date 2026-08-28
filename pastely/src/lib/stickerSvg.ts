const MAX_EDGE = 192
const ALPHA = 32

export interface Silhouette {
  width: number
  height: number
  contentW: number
  contentH: number
  d: string
}

const cache = new Map<string, Promise<Silhouette>>()

export function traceSilhouette(cacheKey: string, src: string): Promise<Silhouette> {
  let pending = cache.get(cacheKey)
  if (!pending) {
    pending = trace(src)
    cache.set(cacheKey, pending)
  }
  return pending
}

async function trace(src: string): Promise<Silhouette> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()

  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) return { width: 1, height: 1, contentW: 1, contentH: 1, d: 'M0 0H1V1H0Z' }

  const sample = Math.min(1, MAX_EDGE / Math.max(width, height))
  const cw = Math.max(1, Math.round(width * sample))
  const ch = Math.max(1, Math.round(height * sample))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return rectPath(width, height)

  ctx.drawImage(img, 0, 0, cw, ch)
  const pixels = ctx.getImageData(0, 0, cw, ch).data

  const mask = new Uint8Array(cw * ch)
  let opaque = 0
  let minX = cw
  let minY = ch
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < mask.length; i++) {
    if (pixels[i * 4 + 3] > ALPHA) {
      mask[i] = 1
      opaque++
      const x = i % cw
      const y = (i / cw) | 0
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  const contentW = maxX < minX ? width : Math.max(1, (maxX - minX + 1) * (width / cw))
  const contentH = maxY < minY ? height : Math.max(1, (maxY - minY + 1) * (height / ch))

  if (opaque < mask.length * 0.01) return rectPath(width, height)

  const contour = outline(mask, cw, ch)
  if (!contour || contour.length < 8) return rectPath(width, height)

  const sx = width / cw
  const sy = height / ch
  const simplified = simplify(contour, 1.4)
  const d = toPath(simplified, sx, sy)
  return { width, height, contentW, contentH, d }
}

function rectPath(width: number, height: number): Silhouette {
  return { width, height, contentW: width, contentH: height, d: `M0 0H${width}V${height}H0Z` }
}

function outline(mask: Uint8Array, w: number, h: number): [number, number][] | null {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1

  let sx = -1
  let sy = -1
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y)) {
        sx = x
        sy = y
        break outer
      }
    }
  }
  if (sx < 0) return null

  const dx = [1, 1, 0, -1, -1, -1, 0, 1]
  const dy = [0, 1, 1, 1, 0, -1, -1, -1]
  const pts: [number, number][] = []
  let x = sx
  let y = sy
  let dir = 0

  for (let n = 0; n < w * h; n++) {
    pts.push([x + 0.5, y + 0.5])
    let found = false
    for (let i = 0; i < 8; i++) {
      const nd = (dir + 6 + i) % 8
      const nx = x + dx[nd]
      const ny = y + dy[nd]
      if (at(nx, ny)) {
        x = nx
        y = ny
        dir = nd
        found = true
        break
      }
    }
    if (!found) break
    if (x === sx && y === sy && pts.length > 2) break
  }

  return pts.length >= 8 ? pts : null
}

function simplify(pts: [number, number][], minDist: number): [number, number][] {
  const out: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1]
    const dx = pts[i][0] - prev[0]
    const dy = pts[i][1] - prev[1]
    if (dx * dx + dy * dy >= minDist * minDist) out.push(pts[i])
  }
  if (out.length < 3) return pts
  return out
}

function toPath(pts: [number, number][], sx: number, sy: number): string {
  let d = `M${+(pts[0][0] * sx).toFixed(1)} ${+(pts[0][1] * sy).toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += `L${+(pts[i][0] * sx).toFixed(1)} ${+(pts[i][1] * sy).toFixed(1)}`
  }
  return `${d}Z`
}
