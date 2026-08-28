import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface Props {
  onCapture: (blob: Blob) => void
}

export default function Camera({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState(false)
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setError(false)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  function shoot() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    setFlash((f) => f + 1)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/png')
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onCapture(file)
    e.target.value = ''
  }

  if (error) {
    return (
      <div className="screen">
        <div className="wordmark">Pastely</div>
        <div className="camera-error">
          <p>Camera is blocked. Allow camera access, or choose a photo instead.</p>
          <button className="btn btn-solid pressable" style={{ flex: 'none', padding: '14px 28px' }} onClick={() => fileRef.current?.click()}>
            Choose from photos
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="viewfinder">
        <video ref={videoRef} autoPlay playsInline muted />
      </div>
      <div className="wordmark">Pastely</div>
      <div className="corners">
        <div className="corner tl" /><div className="corner tr" />
        <div className="corner bl" /><div className="corner br" />
      </div>
      <p className="camera-tip">Tip: fill the frame with the sticker, avoid glare</p>
      <div className="camera-bar">
        <button className="side-btn pressable" aria-label="Choose from photos" onClick={() => fileRef.current?.click()}>
          🖼️
        </button>
        <button className="shutter" aria-label="Take photo" onPointerDown={(e) => e.currentTarget.focus()} onClick={shoot} />
        <button className="side-btn pressable" aria-label="Flip camera" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
          🔄
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="flash"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
