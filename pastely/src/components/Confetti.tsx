import type { CSSProperties } from 'react'

const COLORS = ['#FF4D8D', '#FFC53D', '#2FD08C', '#7C5CFF']

export default function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--a': `${i * 36 + 12}deg`,
              '--d': `${38 + (i % 3) * 16}px`,
              '--c': COLORS[i % COLORS.length],
              '--dl': `${(i % 4) * 30}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
