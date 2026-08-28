import { useEffect, useState } from 'react'
import { traceSilhouette, type Silhouette } from '../lib/stickerSvg'

export function DieCutDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {(['sm', 'lg'] as const).map((s) => (
          <filter key={s} id={`diecut-${s}`} x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" operator="dilate" radius={s === 'sm' ? 7 : 12} result="d" />
            <feFlood floodColor="#ffffff" />
            <feComposite in2="d" operator="in" result="o" />
            <feMerge>
              <feMergeNode in="o" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
    </svg>
  )
}

interface Props {
  src: string
  alt?: string
  size?: 'sm' | 'lg'
  className?: string
  id?: string
}

export default function StickerImg({ src, alt = 'Sticker', size = 'lg', className = '', id }: Props) {
  const [crop, setCrop] = useState<Silhouette | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    traceSilhouette(id, src)
      .then((s) => {
        if (live) setCrop(s)
      })
      .catch(() => {
        if (live) setCrop(null)
      })
    return () => {
      live = false
    }
  }, [id, src])

  const fill = crop && crop.contentW > 0 && crop.contentH > 0
  const img = (
    <img
      src={src}
      alt={alt}
      className={`diecut diecut-${size} ${className}`}
      draggable={false}
      style={
        fill
          ? {
              width: `${(crop.width / crop.contentW) * 100}%`,
              height: `${(crop.height / crop.contentH) * 100}%`,
              maxWidth: 'none',
              maxHeight: 'none',
              position: 'absolute',
              left: `${(-((crop.contentX ?? 0) / crop.contentW)) * 100}%`,
              top: `${(-((crop.contentY ?? 0) / crop.contentH)) * 100}%`,
            }
          : undefined
      }
    />
  )

  if (!id) return img

  return <span className="sticker-crop">{img}</span>
}
