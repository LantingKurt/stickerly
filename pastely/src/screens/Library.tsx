import { motion } from 'motion/react'
import type { Sticker } from '../lib/store'

interface Props {
  stickers: Sticker[]
  urls: Map<string, string>
  newId: string | null
  onOpen: (s: Sticker) => void
  onCamera: () => void
}

export default function Library({ stickers, urls, newId, onOpen, onCamera }: Props) {
  return (
    <div className="screen">
      <header className="lib-header">
        <h1 className="lib-title">Library</h1>
        <button className="icon-btn pressable" aria-label="Open camera" onClick={onCamera}>📷</button>
      </header>
      <div className="grid-scroll">
        {stickers.length === 0 ? (
          <div className="empty-state">
            <div className="big">✨</div>
            <div>No stickers yet</div>
            <button className="cta pressable" onClick={onCamera}>Take a picture of a sticker →</button>
          </div>
        ) : (
          <div className="sticker-grid">
            {stickers.map((s, i) => (
              <motion.button
                key={s.id}
                className="cell checker"
                onClick={() => onOpen(s)}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: Math.min(i * 0.04, 0.24) }}
              >
                {s.id === newId && (
                  <motion.span
                    className="badge-new"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', bounce: 0.5, duration: 0.6, delay: 0.25 }}
                  >
                    NEW
                  </motion.span>
                )}
                {urls.get(s.id) && (
                  <motion.img layoutId={`sticker-${s.id}`} src={urls.get(s.id)} alt="Sticker" />
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
