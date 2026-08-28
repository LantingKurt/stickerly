import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { traceSilhouette, type Silhouette } from '../lib/stickerSvg'
import { useHoverTilt } from '../lib/useHoverTilt'

interface Props {
  id: string
  src: string
  deskW: number
  deskH: number
  zIndex: number
  offsetX: number
  offsetY: number
  entering: boolean
  popNonce: number
  onSelect: () => void
}

const MIN_SCALE = 0.4
const MAX_SCALE = 2.6

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

function rubbered(value: number, min: number, max: number, dim: number) {
  if (value < min) return min - rubberband(min - value, dim)
  if (value > max) return max + rubberband(value - max, dim)
  return value
}

export default function PlaySticker({
  id,
  src,
  deskW,
  deskH,
  zIndex,
  offsetX,
  offsetY,
  entering,
  popNonce,
  onSelect,
}: Props) {
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<Silhouette | null>(null)
  const placed = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    startX: number
    startY: number
    grabX: number
    grabY: number
    startScale: number
    startRotate: number
    startDist: number
    startAngle: number
    lastX: number
    lastY: number
    lastT: number
    vx: number
    vy: number
  } | null>(null)
  const lastPop = useRef(0)
  const { rotateX: tiltX, rotateY: tiltY, glare, track, reset, reduce: reduceTilt } = useHoverTilt(root)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(entering && !reduce ? 0.95 : 1)
  const rotate = useMotionValue(0)
  const press = useMotionValue(1)
  const opacity = useMotionValue(0)

  const transform = useTransform(
    [x, y, scale, rotate, press, tiltX, tiltY],
    ([tx, ty, sc, rot, pr, rx, ry]) =>
      `translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rot}deg) scale(${(sc as number) * (pr as number)})`,
  )

  const size = fit(svg, deskW, deskH)

  useEffect(() => {
    let live = true
    traceSilhouette(id, src)
      .then((s) => {
        if (live) setSvg(s)
      })
      .catch(() => {
        if (live) setSvg({ width: 512, height: 512, d: 'M0 0H512V512H0Z' })
      })
    return () => {
      live = false
    }
  }, [id, src])

  useEffect(() => {
    if (!svg || deskW === 0 || placed.current) return
    placed.current = true
    const { dw, dh } = fit(svg, deskW, deskH)
    x.jump((deskW - dw) / 2 + offsetX)
    y.jump((deskH - dh) / 2 + offsetY)
    if (entering) {
      if (reduce) {
        animate(opacity, 1, { duration: 0.18 })
        scale.jump(1)
      } else {
        animate(opacity, 1, { duration: 0.2 })
        animate(scale, 1, { type: 'spring', bounce: 0.2, duration: 0.5 })
      }
    } else {
      opacity.jump(1)
      scale.jump(1)
    }
  }, [svg, deskW, deskH, offsetX, offsetY, entering, reduce, x, y, scale, opacity])

  useEffect(() => {
    if (!popNonce || popNonce === lastPop.current || reduce) return
    lastPop.current = popNonce
    const current = scale.get()
    animate(scale, current * 1.06, { type: 'spring', bounce: 0.2, duration: 0.28 }).then(() => {
      void animate(scale, current, { type: 'spring', bounce: 0.15, duration: 0.32 })
    })
  }, [popNonce, reduce, scale])

  function bounds() {
    const { dw, dh } = size
    const s = scale.get()
    const w = dw * s
    const h = dh * s
    return {
      minX: 28 - w * 0.7,
      maxX: deskW - 28 - w * 0.3,
      minY: 28 - h * 0.7,
      maxY: deskH - 28 - h * 0.3,
    }
  }

  function beginDrag(pt: { x: number; y: number }) {
    const g = gesture.current
    if (!g) return
    g.startX = x.get()
    g.startY = y.get()
    g.grabX = pt.x
    g.grabY = pt.y
    g.lastX = pt.x
    g.lastY = pt.y
    g.lastT = performance.now()
    g.vx = 0
    g.vy = 0
  }

  function beginPinch() {
    const pts = [...pointers.current.values()]
    if (pts.length < 2 || !gesture.current) return
    const g = gesture.current
    const dx = pts[1].x - pts[0].x
    const dy = pts[1].y - pts[0].y
    g.startDist = Math.hypot(dx, dy) || 1
    g.startAngle = Math.atan2(dy, dx)
    g.startScale = scale.get()
    g.startRotate = rotate.get()
  }

  function onPointerDown(e: PE) {
    e.stopPropagation()
    root.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect()
    reset()

    if (pointers.current.size === 1) {
      x.stop?.()
      y.stop?.()
      gesture.current = {
        startX: x.get(),
        startY: y.get(),
        grabX: e.clientX,
        grabY: e.clientY,
        startScale: scale.get(),
        startRotate: rotate.get(),
        startDist: 1,
        startAngle: 0,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        vx: 0,
        vy: 0,
      }
      press.jump(0.97)
    } else if (pointers.current.size === 2) {
      press.jump(1)
      if (!gesture.current) {
        gesture.current = {
          startX: x.get(),
          startY: y.get(),
          grabX: e.clientX,
          grabY: e.clientY,
          startScale: scale.get(),
          startRotate: rotate.get(),
          startDist: 1,
          startAngle: 0,
          lastX: e.clientX,
          lastY: e.clientY,
          lastT: performance.now(),
          vx: 0,
          vy: 0,
        }
      }
      beginPinch()
    }
  }

  function onPointerMove(e: PE) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const now = performance.now()
    const dt = Math.max(now - g.lastT, 1)

    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dx = pts[1].x - pts[0].x
      const dy = pts[1].y - pts[0].y
      const dist = Math.hypot(dx, dy) || 1
      const angle = Math.atan2(dy, dx)
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * (dist / g.startDist)))
      scale.jump(nextScale)
      if (!reduce) rotate.jump(g.startRotate + ((angle - g.startAngle) * 180) / Math.PI)
      return
    }

    const nx = g.startX + (e.clientX - g.grabX)
    const ny = g.startY + (e.clientY - g.grabY)
    const b = bounds()
    x.jump(rubbered(nx, b.minX, b.maxX, deskW))
    y.jump(rubbered(ny, b.minY, b.maxY, deskH))
    g.vx = (e.clientX - g.lastX) / dt
    g.vy = (e.clientY - g.lastY) / dt
    g.lastX = e.clientX
    g.lastY = e.clientY
    g.lastT = now
  }

  function settle() {
    const g = gesture.current
    const b = bounds()
    const speed = g ? Math.hypot(g.vx, g.vy) : 0
    const bounce = reduce ? 0 : speed > 0.45 ? 0.2 : 0
    const duration = reduce ? 0.22 : speed > 0.45 ? 0.5 : 0.4
    const spring = { type: 'spring' as const, bounce, duration }
    animate(x, Math.min(b.maxX, Math.max(b.minX, x.get())), spring)
    animate(y, Math.min(b.maxY, Math.max(b.minY, y.get())), spring)
    animate(press, 1, { duration: 0.12, ease: [0.23, 1, 0.32, 1] })
  }

  function onPointerUp(e: PE) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      settle()
      gesture.current = null
      return
    }
    if (pointers.current.size === 1) {
      const remain = [...pointers.current.values()][0]
      if (!gesture.current) return
      beginDrag(remain)
    }
  }

  const clipId = `sil-${id}`
  const { dw, dh } = size

  if (!svg || !dw) return null

  return (
    <motion.div
      ref={root}
      className="play-sticker diecut diecut-lg"
      style={{ zIndex, width: dw, height: dh, transform, opacity, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (pointers.current.has(e.pointerId)) onPointerMove(e)
        else track(e)
      }}
      onPointerOut={(e) => {
        if (pointers.current.size > 0) return
        const next = e.relatedTarget
        if (next instanceof Node && root.current?.contains(next)) return
        reset()
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {svg && (
        <svg
          viewBox={`0 0 ${svg.width} ${svg.height}`}
          width="100%"
          height="100%"
          overflow="visible"
          aria-label="Sticker"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={svg.d} />
            </clipPath>
          </defs>
          <image
            href={src}
            width={svg.width}
            height={svg.height}
            clipPath={`url(#${clipId})`}
            style={{ pointerEvents: 'visiblePainted' }}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      )}
      {!reduceTilt && (
        <div
          className="sticker-light"
          style={{
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
          }}
          aria-hidden
        >
          <span className="sticker-sheen" />
          <motion.span className="sticker-glare" style={{ background: glare }} />
        </div>
      )}
    </motion.div>
  )
}

function fit(svg: Silhouette | null, deskW: number, deskH: number) {
  if (!svg || !deskW || !deskH) return { dw: 0, dh: 0 }
  const max = Math.min(deskW, deskH) * 0.48
  const s = Math.min(max / svg.width, max / svg.height)
  return { dw: svg.width * s, dh: svg.height * s }
}
