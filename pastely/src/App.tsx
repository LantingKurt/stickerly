import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Camera from './screens/Camera'
import Preview from './screens/Preview'
import Library from './screens/Library'
import Detail from './screens/Detail'
import Icon from './components/Icon'
import { DieCutDefs } from './components/StickerImg'
import { cutoutSticker } from './lib/cutout'
import { buzz } from './lib/haptics'
import { saveSticker, listStickers, deleteSticker, type Sticker } from './lib/store'

interface Shot {
  cutoutBlob: Blob | null
  url: string | null
  processing: boolean
  failed: boolean
}

export default function App() {
  const [tab, setTab] = useState<'camera' | 'library'>('camera')
  const [shot, setShot] = useState<Shot | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [selected, setSelected] = useState<Sticker | null>(null)
  const [newId, setNewId] = useState<string | null>(null)

  const refresh = useCallback(async () => setStickers(await listStickers()), [])
  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!newId) return
    const t = setTimeout(() => setNewId(null), 5000)
    return () => clearTimeout(t)
  }, [newId])

  const urls = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of stickers) map.set(s.id, URL.createObjectURL(s.blob))
    return map
  }, [stickers])

  const latestUrl = useMemo(() => {
    const latest = [...stickers].sort((a, b) => b.createdAt - a.createdAt)[0]
    return latest ? urls.get(latest.id) : undefined
  }, [stickers, urls])

  async function handleCapture(photo: Blob) {
    setShot({ cutoutBlob: null, url: URL.createObjectURL(photo), processing: true, failed: false })
    try {
      const cutout = await cutoutSticker(photo)
      setShot({ cutoutBlob: cutout, url: URL.createObjectURL(cutout), processing: false, failed: false })
    } catch {
      // Demo insurance: never dead-end — preview the original photo instead
      setShot({ cutoutBlob: photo, url: URL.createObjectURL(photo), processing: false, failed: true })
    }
  }

  async function handleKeep() {
    if (!shot?.cutoutBlob) return
    buzz([10, 40, 10])
    try {
      const saved = await saveSticker(shot.cutoutBlob)
      await refresh()
      setNewId(saved.id)
      setShot(null)
      setTab('library')
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDelete(s: Sticker) {
    await deleteSticker(s.id)
    setSelected(null)
    await refresh()
  }

  return (
    <>
      <DieCutDefs />
      {tab === 'camera' && !shot && <Camera onCapture={handleCapture} latestUrl={latestUrl} />}
      {tab === 'library' && (
        <Library
          stickers={stickers}
          urls={urls}
          newId={newId}
          onOpen={setSelected}
          onCamera={() => setTab('camera')}
        />
      )}

      <AnimatePresence>
        {shot && (
          <Preview
            key="preview"
            imageUrl={shot.url}
            processing={shot.processing}
            cutoutFailed={shot.failed}
            onKeep={handleKeep}
            onRetake={() => setShot(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <Detail
            key={selected.id}
            sticker={selected}
            url={urls.get(selected.id)!}
            onClose={() => setSelected(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      {!shot && (
        <nav className="tabbar">
          {(['library', 'camera'] as const).map((t) => (
            <button
              key={t}
              className={`tab pressable ${tab === t ? 'active' : ''}`}
                  onClick={() => {
                    setTab(t)
                    if (t === 'library') void refresh()
                  }}
              aria-label={t === 'library' ? 'Library' : 'Camera'}
            >
              {tab === t && (
                <motion.span
                  layoutId="tab-pill"
                  className="tab-pill"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.45 }}
                />
              )}
              <span className="tab-content">
                <Icon name={t === 'library' ? 'sparkles' : 'camera'} size={20} />
                {t === 'library' ? 'Library' : 'Camera'}
              </span>
            </button>
          ))}
        </nav>
      )}
    </>
  )
}
