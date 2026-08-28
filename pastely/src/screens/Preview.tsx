import { motion } from 'motion/react'

interface Props {
  imageUrl: string | null
  processing: boolean
  cutoutFailed: boolean
  onKeep: () => void
  onRetake: () => void
}

export default function Preview({ imageUrl, processing, cutoutFailed, onKeep, onRetake }: Props) {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <div className="wordmark">Pastely</div>
      <div className="preview-stage checker">
        {imageUrl && (
          <motion.img
            src={imageUrl}
            alt="Cutout preview"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          />
        )}
        {processing && <div className="processing-note">Cutting out sticker…</div>}
      </div>
      <p className="preview-label">
        {processing ? 'On-device, nothing leaves your phone' : cutoutFailed ? 'Cutout unavailable — keeping the photo as-is' : 'Cutout preview'}
      </p>
      <div className="preview-actions">
        <button className="btn btn-ghost" onClick={onRetake}>Retake</button>
        <button className="btn btn-solid" onClick={onKeep} disabled={processing} style={{ opacity: processing ? 0.4 : 1 }}>
          Keep
        </button>
      </div>
    </motion.div>
  )
}
