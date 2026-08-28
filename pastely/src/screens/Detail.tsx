import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Sticker } from '../lib/store'
import Icon from '../components/Icon'
import StickerImg from '../components/StickerImg'
import { buzz } from '../lib/haptics'

interface Props {
  sticker: Sticker
  url: string
  onClose: () => void
  onDelete: (s: Sticker) => void
}

export default function Detail({ sticker, url, onClose, onDelete }: Props) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  function startHold() {
    setHolding(true)
    timer.current = window.setTimeout(() => {
      buzz(20)
      onDelete(sticker)
    }, 1150)
  }

  function cancelHold() {
    setHolding(false)
    window.clearTimeout(timer.current)
  }

  async function share() {
    const file = new File([sticker.blob], 'sticker.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch { /* user cancelled */ }
    } else {
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
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.25, bottom: 0.8 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.velocity.y > 400 || info.offset.y > 140) onClose()
        }}
      >
        <div className="grabber" />
        <div className="sheet-stage checker">
          <StickerImg src={url} size="lg" />
        </div>
        <span className="date-chip">
          Saved {new Date(sticker.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
        <div className="sheet-actions">
          <button
            className={`btn btn-hold ${holding ? 'holding' : ''}`}
            aria-label="Hold to delete"
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
            <span className="hold-label"><Icon name="trash" size={18} /> Hold to delete</span>
          </button>
          <button className="btn btn-solid" onClick={share}>
            <Icon name="share" size={18} /> Share
          </button>
        </div>
      </motion.div>
    </>
  )
}
