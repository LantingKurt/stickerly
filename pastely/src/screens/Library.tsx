import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import type { Sticker } from '../lib/store'
import Icon from '../components/Icon'
import StickerImg from '../components/StickerImg'
import Confetti from '../components/Confetti'
import { buzz } from '../lib/haptics'

interface Props {
  stickers: Sticker[]
  urls: Map<string, string>
  newId: string | null
  editing: boolean
  onEditingChange: (v: boolean) => void
  onOpen: (s: Sticker) => void
  onCamera: () => void
  onReorder: (ids: string[], persist: boolean) => void
  onDelete: (ids: string[]) => void
}

const HOLD_MS = 420
const DRAG_PX = 10

function tilt(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 5) - 2
}

interface Drag {
  id: string
  pointerId: number
  startX: number
  startY: number
  originLeft: number
  originTop: number
  w: number
  h: number
  moved: boolean
  holdFired: boolean
}

export default function Library({
  stickers,
  urls,
  newId,
  editing,
  onEditingChange,
  onOpen,
  onCamera,
  onReorder,
  onDelete,
}: Props) {
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [armed, setArmed] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [ghostBox, setGhostBox] = useState({ w: 0, h: 0 })
  const gridRef = useRef<HTMLDivElement>(null)
  const stickersRef = useRef(stickers)
  const editingRef = useRef(editing)
  const dragRef = useRef<Drag | null>(null)
  const orderRef = useRef(stickers.map((s) => s.id))
  const finishing = useRef(false)
  const holdTimer = useRef<number>(0)
  const ghostX = useMotionValue(0)
  const ghostY = useMotionValue(0)
  const ghostScale = useMotionValue(1)

  stickersRef.current = stickers
  editingRef.current = editing
  orderRef.current = stickers.map((s) => s.id)

  useEffect(() => {
    if (editing) return
    setPicked(new Set())
    setArmed(false)
  }, [editing])

  const nPicked = picked.size
  const ghost = dragId ? stickers.find((s) => s.id === dragId) : undefined
  const ghostSrc = ghost ? urls.get(ghost.id) : undefined

  function enterEdit(id?: string) {
    editingRef.current = true
    onEditingChange(true)
    setArmed(false)
    if (id) setPicked(new Set([id]))
  }

  function exitEdit() {
    editingRef.current = false
    onEditingChange(false)
  }

  function togglePick(id: string) {
    setArmed(false)
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function slotIndex(clientX: number, clientY: number) {
    const cells = gridRef.current?.querySelectorAll<HTMLElement>('[data-sticker-id]')
    if (!cells || cells.length === 0) return 0
    let best = 0
    let bestDist = Infinity
    cells.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2))
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    return best
  }

  function moveToSlot(id: string, clientX: number, clientY: number) {
    const ids = stickersRef.current.map((s) => s.id)
    const from = ids.indexOf(id)
    const to = slotIndex(clientX, clientY)
    if (from < 0 || from === to) return
    const next = ids.slice()
    const [item] = next.splice(from, 1)
    if (!item) return
    next.splice(to, 0, item)
    orderRef.current = next
    onReorder(next, false)
  }

  function startDrag(id: string, e: PE<HTMLElement>) {
    const cell = e.currentTarget
    const r = cell.getBoundingClientRect()
    ghostX.jump(r.left)
    ghostY.jump(r.top)
    ghostScale.jump(reduce ? 1 : 1.08)
    setGhostBox({ w: r.width, h: r.height })
    cell.setPointerCapture(e.pointerId)
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: r.left,
      originTop: r.top,
      w: r.width,
      h: r.height,
      moved: true,
      holdFired: dragRef.current?.holdFired ?? false,
    }
    setDragId(id)
    buzz(8)
  }

  function onCellDown(s: Sticker, e: PE<HTMLButtonElement>) {
    if (e.button !== 0) return
    window.clearTimeout(holdTimer.current)
    const r = e.currentTarget.getBoundingClientRect()
    dragRef.current = {
      id: s.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: r.left,
      originTop: r.top,
      w: r.width,
      h: r.height,
      moved: false,
      holdFired: false,
    }
    if (!editingRef.current) {
      holdTimer.current = window.setTimeout(() => {
        const p = dragRef.current
        if (!p || p.id !== s.id || p.moved) return
        p.holdFired = true
        buzz(12)
        enterEdit(s.id)
      }, HOLD_MS)
    }
  }

  function onCellMove(s: Sticker, e: PE<HTMLButtonElement>) {
    const p = dragRef.current
    if (!p || p.pointerId !== e.pointerId || p.id !== s.id) return
    const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY)
    if (!p.moved && dist > DRAG_PX) {
      window.clearTimeout(holdTimer.current)
      if (!editingRef.current) {
        dragRef.current = null
        return
      }
      startDrag(s.id, e)
    }
    const live = dragRef.current
    if (!live?.moved) return
    ghostX.jump(live.originLeft + (e.clientX - live.startX))
    ghostY.jump(live.originTop + (e.clientY - live.startY))
    moveToSlot(live.id, e.clientX, e.clientY)
  }

  async function finishDrag() {
    const p = dragRef.current
    const id = p?.id ?? dragId
    if (finishing.current) return
    finishing.current = true
    dragRef.current = null
    window.clearTimeout(holdTimer.current)
    if (!id || !p?.moved) {
      finishing.current = false
      setDragId(null)
      return
    }
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-sticker-id="${id}"]`)
    if (cell && !reduce) {
      const r = cell.getBoundingClientRect()
      const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }
      await Promise.all([
        animate(ghostX, r.left, spring),
        animate(ghostY, r.top, spring),
        animate(ghostScale, 1, { duration: 0.2, ease: [0.23, 1, 0.32, 1] }),
      ])
    }
    setDragId(null)
    onReorder(orderRef.current, true)
    finishing.current = false
  }

  function onCellUp(s: Sticker, e: PE<HTMLButtonElement>) {
    const p = dragRef.current
    if (!p || p.pointerId !== e.pointerId) return
    window.clearTimeout(holdTimer.current)
    if (p.moved) {
      void finishDrag()
      return
    }
    dragRef.current = null
    if (e.type === 'pointercancel' || p.holdFired) return
    if (editingRef.current) togglePick(s.id)
    else onOpen(s)
  }

  async function confirmDelete() {
    if (nPicked === 0) return
    if (!armed) {
      setArmed(true)
      return
    }
    const ids = [...picked]
    setArmed(false)
    setPicked(new Set())
    const remaining = stickersRef.current.length - ids.length
    if (remaining <= 0) exitEdit()
    onDelete(ids)
  }

  return (
    <div className="screen">
      <header className="lib-header">
        <div className="lib-head-left">
          <h1 className="lib-title">{editing ? (nPicked ? `${nPicked} selected` : 'Select') : 'Library'}</h1>
          {!editing && stickers.length > 0 && <span className="lib-count">{stickers.length}</span>}
        </div>
        <div className="lib-head-actions">
          {stickers.length > 0 && (
            <button
              className="text-btn pressable"
              onClick={() => (editing ? exitEdit() : enterEdit())}
            >
              {editing ? 'Done' : 'Select'}
            </button>
          )}
          {!editing && (
            <button className="icon-btn pressable" aria-label="Open camera" onClick={onCamera}>
              <Icon name="camera" size={20} />
            </button>
          )}
        </div>
      </header>
      {editing && stickers.length > 0 && (
        <p className="lib-hint">Tap to select · Drag to rearrange</p>
      )}
      <div className={`grid-scroll ${dragId ? 'is-locked' : ''}`}>
        {stickers.length === 0 ? (
          <div className="empty-state">
            <svg width="104" height="104" viewBox="0 0 104 104" fill="none" aria-hidden>
              <g transform="rotate(-7 52 46)">
                <rect x="24" y="18" width="56" height="56" rx="14" fill="#FFFDF8" stroke="#211D19" strokeWidth="3" />
                <path d="M66 74c9-2 15-8 17-16l-17 2v14Z" fill="#EFE9DC" stroke="#211D19" strokeWidth="3" strokeLinejoin="round" />
                <path d="M48 32l2.6 6.8 6.8 2.6-6.8 2.6-2.6 6.8-2.6-6.8-6.8-2.6 6.8-2.6L48 32Z" fill="#FF4D8D" />
              </g>
              <path d="M30 86h44" stroke="#211D19" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 8" />
            </svg>
            <div className="empty-title">No stickers yet</div>
            <div>Your sticker book is a blank page.</div>
            <button className="cta pressable" onClick={onCamera}>Take a picture of a sticker</button>
          </div>
        ) : (
          <div className={`sticker-grid ${editing ? 'is-editing' : ''}`} ref={gridRef}>
            <AnimatePresence initial={false} mode="popLayout">
              {stickers.map((s) => {
                const isNew = s.id === newId
                const isSlot = dragId === s.id
                const isPicked = picked.has(s.id)
                return (
                  <motion.button
                    key={s.id}
                    data-sticker-id={s.id}
                    className={`cell checker ${isPicked ? 'picked' : ''} ${isSlot ? 'is-slot' : ''}`}
                    aria-pressed={editing ? isPicked : undefined}
                    aria-label={editing ? (isPicked ? 'Deselect sticker' : 'Select sticker') : 'Open sticker'}
                    onPointerDown={(e) => onCellDown(s, e)}
                    onPointerMove={(e) => onCellMove(s, e)}
                    onPointerUp={(e) => onCellUp(s, e)}
                    onPointerCancel={(e) => onCellUp(s, e)}
                    onContextMenu={(e) => e.preventDefault()}
                    layout={!reduce}
                    whileTap={editing || isSlot ? undefined : { scale: 0.95 }}
                    initial={isNew ? { opacity: 0, scale: 1.3, rotate: -6 } : false}
                    animate={{ opacity: isSlot ? 0 : 1, scale: 1, rotate: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                    transition={
                      isNew
                        ? { type: 'spring', bounce: 0.5, duration: 0.7 }
                        : { type: 'spring', bounce: 0, duration: 0.4 }
                    }
                  >
                    {isNew && <Confetti />}
                    {isNew && (
                      <motion.span
                        className="badge-new"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', bounce: 0.5, duration: 0.6, delay: 0.3 }}
                      >
                        NEW
                      </motion.span>
                    )}
                    {editing && (
                      <span className={`cell-check ${isPicked ? 'on' : ''}`}>
                        {isPicked && <Icon name="check" size={13} />}
                      </span>
                    )}
                    <div className="cell-inner" style={{ transform: `rotate(${tilt(s.id)}deg)` }}>
                      {urls.get(s.id) && <StickerImg src={urls.get(s.id)!} size="sm" />}
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {editing && (
        <div className="edit-bar">
          {armed && (
            <button className="btn btn-ghost" onClick={() => setArmed(false)}>
              Cancel
            </button>
          )}
          <button
            className={`btn ${armed ? 'btn-danger' : 'btn-danger-ghost'}`}
            disabled={nPicked === 0}
            onClick={() => void confirmDelete()}
          >
            <Icon name="trash" size={18} />
            {armed ? `Delete ${nPicked}?` : nPicked ? `Delete ${nPicked}` : 'Delete'}
          </button>
        </div>
      )}

      {ghost && ghostSrc &&
        createPortal(
          <motion.div
            className="cell checker drag-ghost"
            style={{
              width: ghostBox.w,
              height: ghostBox.h,
              x: ghostX,
              y: ghostY,
              scale: ghostScale,
            }}
          >
            <div className="cell-inner" style={{ transform: `rotate(${tilt(ghost.id)}deg)` }}>
              <StickerImg src={ghostSrc} size="sm" />
            </div>
          </motion.div>,
          document.body,
        )}
    </div>
  )
}
