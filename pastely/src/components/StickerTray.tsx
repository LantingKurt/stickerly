import type { Sticker } from '../lib/store'
import StickerImg from './StickerImg'

interface Props {
  stickers: Sticker[]
  urls: Map<string, string>
  onDesk: Set<string>
  onPick: (s: Sticker) => void
}

export default function StickerTray({ stickers, urls, onDesk, onPick }: Props) {
  if (stickers.length === 0) return null

  return (
    <div className="sticker-tray" role="listbox" aria-label="Sticker tray">
      {stickers.map((s) => {
        const src = urls.get(s.id)
        const active = onDesk.has(s.id)
        return (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={active}
            className={`tray-cell pressable ${active ? 'on-desk' : ''}`}
            onClick={() => onPick(s)}
          >
            {src && <StickerImg src={src} size="sm" />}
          </button>
        )
      })}
    </div>
  )
}
