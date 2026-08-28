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
}

export default function StickerImg({ src, alt = 'Sticker', size = 'lg', className = '' }: Props) {
  return <img src={src} alt={alt} className={`diecut diecut-${size} ${className}`} draggable={false} />
}
