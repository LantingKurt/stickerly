import { useRef, type PointerEvent as PE, type RefObject } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'

interface Props {
  onRedeem?: () => void
}

/** Pointer-follow tilt used by the golden ticket. Same springs, glare, and parallax. */
export function useTicketTilt(field: RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const spring = { stiffness: 150, damping: 17, mass: 0.7 }
  const sx = useSpring(px, spring)
  const sy = useSpring(py, spring)

  const rotateX = useTransform(sy, [-1, 1], [14, -14])
  const rotateY = useTransform(sx, [-1, 1], [-22, 22])
  const moveX = useTransform(sx, [-1, 1], [-10, 10])
  const moveY = useTransform(sy, [-1, 1], [-6, 6])
  const glareX = useTransform(sx, [-1, 1], [6, 94])
  const glareY = useTransform(sy, [-1, 1], [8, 92])
  const glare = useMotionTemplate`radial-gradient(circle 48% at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.2) 34%, rgba(255, 255, 255, 0) 68%)`
  const stickerGlare = useMotionTemplate`radial-gradient(circle 42% at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0) 70%)`

  function track(e: PE) {
    if (reduce) return
    const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : field.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = r.width || 1
    const h = r.height || 1
    px.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / w) * 2 - 1)))
    py.set(Math.max(-1, Math.min(1, ((e.clientY - r.top) / h) * 2 - 1)))
  }

  function release(e: PE) {
    if (e.pointerType !== 'mouse') reset()
  }

  function reset() {
    px.set(0)
    py.set(0)
  }

  return { rotateX, rotateY, moveX, moveY, glare, stickerGlare, track, release, reset, reduce }
}

export default function GoldenTicket({ onRedeem }: Props) {
  const ticket = useRef<HTMLButtonElement>(null)
  const { rotateX, rotateY, moveX, moveY, glare, track, release, reset, reduce } = useTicketTilt(ticket)

  return (
    <div className="ticket-field">
      <motion.div
        className="gt-drop"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: '-70%' }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduce
            ? { duration: 0.18 }
            : {
                y: { type: 'spring', bounce: 0.16, duration: 0.62 },
                opacity: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
              }
        }
      >
        <motion.button
          ref={ticket}
          type="button"
          className="golden-ticket"
          onClick={onRedeem}
          aria-label="Golden ticket — take a picture of a sticker"
          style={reduce ? undefined : { rotateX, rotateY, x: moveX, y: moveY }}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          onPointerDown={track}
          onPointerMove={track}
          onPointerUp={release}
          onPointerLeave={reset}
          onPointerCancel={reset}
        >
          <span className="gt-sway">
            <span className="gt-body">
              <span className="gt-stub">
                <span className="gt-stub-text">Admit one</span>
              </span>
              <span className="gt-main">
                <span className="gt-kicker">Pastely</span>
                <span className="gt-title">
                  Golden Ticket <span className="gt-star">✦</span>
                </span>
                <span className="gt-sub">Good for one perfectly cut sticker</span>
              </span>
              <span className="gt-sheen" aria-hidden />
              <motion.span className="gt-glare" style={reduce ? undefined : { background: glare }} aria-hidden />
            </span>
          </span>
        </motion.button>
      </motion.div>
    </div>
  )
}
