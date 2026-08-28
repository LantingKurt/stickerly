import { motion } from 'motion/react'
import type { Sticker } from '../lib/store'

interface Props {
  sticker: Sticker
  url: string
  onClose: () => void
  onDelete: (s: Sticker) => void
}

export default function Detail({ sticker, url, onClose, onDelete }: Props) {
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
          <motion.img layoutId={`sticker-${sticker.id}`} src={url} alt="Sticker" draggable={false} />
        </div>
        <p className="sheet-date">
          Saved {new Date(sticker.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        <div className="sheet-actions">
          <button className="btn btn-danger" onClick={() => { if (confirm('Delete this sticker?')) onDelete(sticker) }}>
            Delete
          </button>
          <button className="btn btn-solid" onClick={share}>Share</button>
        </div>
      </motion.div>
    </>
  )
}
