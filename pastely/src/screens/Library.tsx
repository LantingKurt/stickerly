import { motion } from 'motion/react'
import type { Sticker } from '../lib/store'
import Icon from '../components/Icon'
import StickerImg from '../components/StickerImg'
import Confetti from '../components/Confetti'

interface Props {
  stickers: Sticker[]
  urls: Map<string, string>
  newId: string | null
  onOpen: (s: Sticker) => void
  onCamera: () => void
}

function tilt(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 5) - 2
}

export default function Library({ stickers, urls, newId, onOpen, onCamera }: Props) {
  return (
    <div className="screen">
      <header className="lib-header">
        <div className="lib-head-left">
          <h1 className="lib-title">Library</h1>
          {stickers.length > 0 && <span className="lib-count">{stickers.length}</span>}
        </div>
        <button className="icon-btn pressable" aria-label="Open camera" onClick={onCamera}>
          <Icon name="camera" size={20} />
        </button>
      </header>
      <div className="grid-scroll">
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
          <div className="sticker-grid">
            {stickers.map((s, i) => {
              const isNew = s.id === newId
              return (
                <motion.button
                  key={s.id}
                  className="cell checker"
                  onClick={() => onOpen(s)}
                  whileTap={{ scale: 0.95 }}
                  initial={isNew ? { opacity: 0, scale: 1.3, rotate: -6 } : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={
                    isNew
                      ? { type: 'spring', bounce: 0.5, duration: 0.7 }
                      : { type: 'spring', bounce: 0, duration: 0.4, delay: Math.min(i * 0.04, 0.24) }
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
                  <div className="cell-inner" style={{ transform: `rotate(${tilt(s.id)}deg)` }}>
                    {urls.get(s.id) && <StickerImg src={urls.get(s.id)!} size="sm" />}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
