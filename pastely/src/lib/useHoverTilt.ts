import { type PointerEvent as PE, type RefObject } from 'react'
import {
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'

const SPRING = { stiffness: 150, damping: 17, mass: 0.7 }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Mouse-hover tilt + foil glare. Does nothing on touch. */
export function useHoverTilt(el: RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)
  const rotateX = useTransform(sy, [-1, 1], [14, -14])
  const rotateY = useTransform(sx, [-1, 1], [-22, 22])
  const glareX = useTransform(sx, [-1, 1], [18, 82])
  const glareY = useTransform(sy, [-1, 1], [12, 88])
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 55%)`

  function track(e: PE) {
    const node = el.current
    if (!node || reduce || e.pointerType !== 'mouse') return
    const r = node.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return
    px.set(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1))
    py.set(clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1))
  }

  function reset() {
    px.set(0)
    py.set(0)
  }

  return { rotateX, rotateY, glare, track, reset, reduce }
}
