import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import Camera from './screens/Camera'
import Preview from './screens/Preview'
import Library from './screens/Library'
import Detail from './screens/Detail'
import { cutoutSticker } from './lib/cutout'
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

  const urls = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of stickers) map.set(s.id, URL.createObjectURL(s.blob))
    return map
  }, [stickers])

  async function handleCapture(photo: Blob) {
    setShot({ cutoutBlob: null, url: null, processing: true, failed: false })
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
    const saved = await saveSticker(shot.cutoutBlob)
    await refresh()
    setNewId(saved.id)
    setShot(null)
    setTab('library')
  }

  async function handleDelete(s: Sticker) {
    await deleteSticker(s.id)
    setSelected(null)
    await refresh()
  }

  return (
    <>
      {tab === 'camera' && !shot && <Camera onCapture={handleCapture} />}
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
          <button className={`tab pressable ${tab === 'library' ? 'active' : ''}`} onClick={() => setTab('library')}>
            <span className="glyph">⭐</span>Library
          </button>
          <button className={`tab pressable ${tab === 'camera' ? 'active' : ''}`} onClick={() => setTab('camera')}>
            <span className="glyph">📷</span>Camera
          </button>
        </nav>
      )}
    </>
  )
}
