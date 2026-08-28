import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useDragControls, useReducedMotion } from 'motion/react'
import type { Sticker } from '../lib/store'
import Icon from '../components/Icon'
import PlaySticker from '../components/PlaySticker'
import StickerTray from '../components/StickerTray'
import { buzz } from '../lib/haptics'

interface Props {
  opened: Sticker
  stickers: Sticker[]
  urls: Map<string, string>
  onClose: () => void
  onDelete: (s: Sticker) => void
}

function jitter(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return { x: (Math.abs(h) % 70) - 35, y: (Math.abs(h >> 8) % 50) - 25 }
}

export default function Playground({ opened, stickers, urls, onClose, onDelete }: Props) {
  const reduce = useReducedMotion()
  const controls = useDragControls()
  const deskRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [holding, setHolding] = useState(false)
  const [desk, setDesk] = useState({ w: 0, h: 0 })
  const [onDesk, setOnDesk] = useState<string[]>(() => [opened.id])
  const [zOrder, setZOrder] = useState<string[]>(() => [opened.id])
  const [selectedId, setSelectedId] = useState(opened.id)
  const [pop, setPop] = useState<Record<string, number>>({})

  const byId = useMemo(() => new Map(stickers.map((s) => [s.id, s])), [stickers])
  const liveIds = useMemo(() => new Set(stickers.map((s) => s.id)), [stickers])
  const deskIds = onDesk.filter((id) => liveIds.has(id))
  const deskSet = new Set(deskIds)
  const selectedLive = deskIds.includes(selectedId) ? selectedId : deskIds[deskIds.length - 1]
  const selected = selectedLive ? byId.get(selectedLive) : undefined

  useEffect(() => {
    const el = deskRef.current
    if (!el) return
    const measure = () => {
      setDesk({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (deskIds.length === 0) onClose()
  }, [deskIds.length, onClose])

  function bringToFront(id: string) {
    setSelectedId(id)
    setZOrder((prev) => [...prev.filter((x) => x !== id), id])
  }

  function pickFromTray(s: Sticker) {
    if (deskSet.has(s.id)) {
      bringToFront(s.id)
      setPop((p) => ({ ...p, [s.id]: (p[s.id] ?? 0) + 1 }))
      return
    }
    setOnDesk((prev) => [...prev, s.id])
    bringToFront(s.id)
  }

  function startHold() {
    if (!selected) return
    setHolding(true)
    timer.current = window.setTimeout(() => {
      buzz(20)
      onDelete(selected)
    }, 1150)
  }

  function cancelHold() {
    setHolding(false)
    window.clearTimeout(timer.current)
  }

  async function share() {
    if (!selected) return
    const url = urls.get(selected.id)
    const file = new File([selected.blob], 'sticker.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch {
        /* user cancelled */
      }
    } else if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = 'sticker.png'
      a.click()
    }
  }

  return (
    <>
      <motion.div
        className="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet playground"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={
          reduce
            ? { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
            : { type: 'spring', bounce: 0, duration: 0.4 }
        }
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.08, bottom: 0.7 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.velocity.y > 400 || info.offset.y > 80) onClose()
        }}
      >
        <div className="grabber-hit" onPointerDown={(e) => controls.start(e)}>
          <div className="grabber" />
        </div>
        <button className="play-close pressable" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
        <div className="desk" ref={deskRef}>
          {desk.w > 0 &&
            deskIds.map((id) => {
              const src = urls.get(id)
              if (!src) return null
              const origin = id === opened.id
              const j = origin ? { x: 0, y: 0 } : jitter(id)
              return (
                <PlaySticker
                  key={id}
                  id={id}
                  src={src}
                  deskW={desk.w}
                  deskH={desk.h}
                  zIndex={10 + zOrder.indexOf(id)}
                  offsetX={j.x}
                  offsetY={j.y}
                  entering={!origin}
                  popNonce={pop[id] ?? 0}
                  onSelect={() => bringToFront(id)}
                />
              )
            })}
        </div>
        <div className="play-chrome">
          <div className="sheet-actions">
            <button
              className={`btn btn-hold ${holding ? 'holding' : ''}`}
              aria-label="Hold to delete"
              disabled={!selected}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) startHold()
              }}
              onKeyUp={cancelHold}
            >
              <span className="fill" />
              <span className="hold-label">
                <Icon name="trash" size={18} /> Hold to delete
              </span>
            </button>
            <button className="btn btn-solid" onClick={share} disabled={!selected}>
              <Icon name="share" size={18} /> Share
            </button>
          </div>
          {stickers.length > 1 && (
            <StickerTray stickers={stickers} urls={urls} onDesk={deskSet} onPick={pickFromTray} />
          )}
        </div>
      </motion.div>
    </>
  )
}
