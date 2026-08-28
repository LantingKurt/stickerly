const MAX_EDGE = 384
const ALPHA_TRIES = [24, 48, 80, 128, 176, 220]

export interface Silhouette {
  width: number
  height: number
  contentX: number
  contentY: number
  contentW: number
  contentH: number
  d: string
}

const cache = new Map<string, Promise<Silhouette>>()

export function traceSilhouette(cacheKey: string, src: string): Promise<Silhouette> {
  const key = `${cacheKey}:v4`
  let pending = cache.get(key)
  if (!pending) {
    pending = trace(src)
    cache.set(key, pending)
  }
  return pending
}

export async function cropToOpaque(blob: Blob): Promise<Blob> {
  const src = URL.createObjectURL(blob)
  try {
    const sil = await trace(src)
    if (sil.contentW >= sil.width * 0.9 && sil.contentH >= sil.height * 0.9) return blob

    const img = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sil.contentW))
    canvas.height = Math.max(1, Math.round(sil.contentH))
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(
      img,
      sil.contentX,
      sil.contentY,
      sil.contentW,
      sil.contentH,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    const cropped = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    return cropped ?? blob
  } catch {
    return blob
  } finally {
    URL.revokeObjectURL(src)
  }
}

async function trace(src: string): Promise<Silhouette> {
  const img = await loadImage(src)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) return rectPath(1, 1)

  const pixels = await readPixels(img, width, height)
  const { cw, ch, data } = pixels
  const sx = width / cw
  const sy = height / ch

  const picked = pickAlphaMask(data, cw, ch) ?? colorMask(data, cw, ch)
  if (!picked) return rectPath(width, height)

  const { mask, box } = picked
  const padded = padBox(box, cw, ch, 0.08)
  const contentX = padded.minX * sx
  const contentY = padded.minY * sy
  const contentW = Math.max(1, (padded.maxX - padded.minX + 1) * sx)
  const contentH = Math.max(1, (padded.maxY - padded.minY + 1) * sy)

  const contour = outline(mask, cw, ch)
  if (!contour || contour.length < 8) {
    return { width, height, contentX, contentY, contentW, contentH, d: rectPath(width, height).d }
  }

  const simplified = simplify(contour, 1.4)
  const d = toPath(simplified, sx, sy)
  return { width, height, contentX, contentY, contentW, contentH, d }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode sticker'))
    img.src = src
  })
}

async function readPixels(img: HTMLImageElement, width: number, height: number) {
  const sample = Math.min(1, MAX_EDGE / Math.max(width, height))
  const cw = Math.max(1, Math.round(width * sample))
  const ch = Math.max(1, Math.round(height * sample))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!ctx) throw new Error('No canvas')

  let source: CanvasImageSource = img
  try {
    source = await createImageBitmap(img, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
  } catch {
    /* Safari without those options still draws the image. */
  }

  ctx.clearRect(0, 0, cw, ch)
  ctx.globalCompositeOperation = 'copy'
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, cw, ch)
  ctx.globalCompositeOperation = 'source-over'
  return { cw, ch, data: ctx.getImageData(0, 0, cw, ch).data }
}

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
  n: number
}

function boxOf(mask: Uint8Array, cw: number, ch: number): Box | null {
  let minX = cw
  let minY = ch
  let maxX = -1
  let maxY = -1
  let n = 0
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (!mask[y * cw + x]) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (n === 0 || maxX < 0) return null
  return { minX, minY, maxX, maxY, n }
}

function pickAlphaMask(data: Uint8ClampedArray, cw: number, ch: number) {
  const area = cw * ch
  let best: { mask: Uint8Array; box: Box; fill: number } | null = null
  for (const t of ALPHA_TRIES) {
    const mask = new Uint8Array(cw * ch)
    for (let i = 0; i < mask.length; i++) {
      if (data[i * 4 + 3] > t) mask[i] = 1
    }
    const box = boxOf(mask, cw, ch)
    if (!box || box.n < area * 0.004) continue
    const fill = ((box.maxX - box.minX + 1) * (box.maxY - box.minY + 1)) / area
    if (!best || fill < best.fill) best = { mask, box, fill }
  }
  if (!best || best.fill > 0.88) return null
  return best
}

function colorMask(data: Uint8ClampedArray, cw: number, ch: number) {
  const br: number[] = []
  const bg: number[] = []
  const bb: number[] = []
  const ba: number[] = []
  const push = (x: number, y: number) => {
    const i = (y * cw + x) * 4
    br.push(data[i])
    bg.push(data[i + 1])
    bb.push(data[i + 2])
    ba.push(data[i + 3])
  }
  for (let x = 0; x < cw; x++) {
    push(x, 0)
    push(x, ch - 1)
  }
  for (let y = 1; y < ch - 1; y++) {
    push(0, y)
    push(cw - 1, y)
  }
  const med = (v: number[]) => {
    const s = v.slice().sort((a, b) => a - b)
    return s[s.length >> 1] ?? 0
  }
  const r0 = med(br)
  const g0 = med(bg)
  const b0 = med(bb)
  const a0 = med(ba)

  const mask = new Uint8Array(cw * ch)
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4
    const d =
      Math.abs(data[o] - r0) +
      Math.abs(data[o + 1] - g0) +
      Math.abs(data[o + 2] - b0) +
      Math.abs(data[o + 3] - a0)
    if (d > 48) mask[i] = 1
  }
  const box = boxOf(mask, cw, ch)
  if (!box || box.n < cw * ch * 0.004) return null
  const fill = ((box.maxX - box.minX + 1) * (box.maxY - box.minY + 1)) / (cw * ch)
  if (fill > 0.92) return null
  return { mask, box, fill }
}

function padBox(box: Box, cw: number, ch: number, ratio: number) {
  const w = box.maxX - box.minX + 1
  const h = box.maxY - box.minY + 1
  const pad = Math.max(2, Math.round(Math.max(w, h) * ratio))
  return {
    minX: Math.max(0, box.minX - pad),
    minY: Math.max(0, box.minY - pad),
    maxX: Math.min(cw - 1, box.maxX + pad),
    maxY: Math.min(ch - 1, box.maxY + pad),
  }
}

function rectPath(width: number, height: number): Silhouette {
  return {
    width,
    height,
    contentX: 0,
    contentY: 0,
    contentW: width,
    contentH: height,
    d: `M0 0H${width}V${height}H0Z`,
  }
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
