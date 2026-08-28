import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Icon from '../components/Icon'
import StickerImg from '../components/StickerImg'

interface Props {
  imageUrl: string | null
  processing: boolean
  cutoutFailed: boolean
  onKeep: () => void
  onRetake: () => void
}

const MSGS = ['Peeling the background…', 'Trimming the edges…', 'Almost there…']

export default function Preview({ imageUrl, processing, cutoutFailed, onKeep, onRetake }: Props) {
  const [mi, setMi] = useState(0)
  useEffect(() => {
    if (!processing) return
    const t = setInterval(() => setMi((i) => (i + 1) % MSGS.length), 1500)
    return () => clearInterval(t)
  }, [processing])

  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <div className="wordmark">Pastel<span className="y">y</span></div>
      <div className="preview-stage checker">
        {imageUrl &&
          (processing ? (
            <motion.img
              key={imageUrl}
              className="photo"
              src={imageUrl}
              alt="Captured photo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          ) : (
            <motion.div
              key={imageUrl}
              className="sticker-wrap"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
            >
              <StickerImg src={imageUrl} size="lg" alt="Cutout preview" />
            </motion.div>
          ))}
        {processing && <div className="scan" />}
      </div>
      <p className="preview-label">
        {processing
          ? `${MSGS[mi]} · on-device, nothing leaves your phone`
          : cutoutFailed
            ? 'Cutout unavailable — keeping the photo as-is'
            : 'Cutout preview'}
      </p>
      <div className="preview-actions">
        <button className="btn btn-ghost" onClick={onRetake}>Retake</button>
        <button className="btn btn-solid" onClick={onKeep} disabled={processing}>
          <Icon name="check" size={20} /> Keep
        </button>
      </div>
    </motion.div>
  )
}
