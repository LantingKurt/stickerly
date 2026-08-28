import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import Camera from './screens/Camera'
import Preview from './screens/Preview'
import Library from './screens/Library'
import Playground from './screens/Playground'
import Icon from './components/Icon'
import { DieCutDefs } from './components/StickerImg'
import { cutoutSticker } from './lib/cutout'
import { buzz } from './lib/haptics'
import {
  saveSticker,
  listStickers,
  deleteStickers,
  reorderStickers,
  type Sticker,
} from './lib/store'

interface Shot {
  cutoutBlob: Blob | null
  url: string | null
  processing: boolean
  failed: boolean
}

const stickerUrls = new Map<string, string>()

function urlsFor(stickers: Sticker[]): Map<string, string> {
  const live = new Set(stickers.map((s) => s.id))
  for (const [id, url] of stickerUrls) {
    if (!live.has(id)) {
      URL.revokeObjectURL(url)
      stickerUrls.delete(id)
    }
  }
  const next = new Map<string, string>()
  for (const s of stickers) {
    let url = stickerUrls.get(s.id)
    if (!url) {
      url = URL.createObjectURL(s.blob)
      stickerUrls.set(s.id, url)
    }
    next.set(s.id, url)
  }
  return next
}

export default function App() {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [selected, setSelected] = useState<Sticker | null>(null)
  const [newId, setNewId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const keepingRef = useRef(false)

  const openCamera = useCallback(() => {
    setEditing(false)
    setCameraOpen(true)
  }, [])

  const refresh = useCallback(async () => setStickers(await listStickers()), [])
  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!newId) return
    const t = setTimeout(() => setNewId(null), 5000)
    return () => clearTimeout(t)
  }, [newId])

  const urls = useMemo(() => urlsFor(stickers), [stickers])

  const latestUrl = useMemo(() => {
    const latest = [...stickers].sort((a, b) => b.createdAt - a.createdAt)[0]
    return latest ? urls.get(latest.id) : undefined
  }, [stickers, urls])

  async function handleCapture(photo: Blob) {
    keepingRef.current = false
    setKeeping(false)
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
    if (!shot?.cutoutBlob || keepingRef.current) return
    keepingRef.current = true
    setKeeping(true)
    buzz([10, 40, 10])
    try {
      const saved = await saveSticker(shot.cutoutBlob)
      await refresh()
      setNewId(saved.id)
      setShot(null)
      setCameraOpen(false)
      setEditing(false)
      keepingRef.current = false
      setKeeping(false)
    } catch (err) {
      console.error(err)
      keepingRef.current = false
      setKeeping(false)
    }
  }

  function applyOrder(ids: string[]) {
    setStickers((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]))
      const next: Sticker[] = []
      for (const id of ids) {
        const s = byId.get(id)
        if (s) next.push(s)
      }
      return next.length === prev.length ? next : prev
    })
  }

  function handleReorder(ids: string[], persist: boolean) {
    applyOrder(ids)
    if (!persist) return
    void reorderStickers(ids).catch(() => refresh())
  }

  async function handleDeleteMany(ids: string[]) {
    setStickers((prev) => prev.filter((s) => !ids.includes(s.id)))
    setSelected((s) => (s && ids.includes(s.id) ? null : s))
    try {
      await deleteStickers(ids)
    } catch {
      await refresh()
    }
  }

  const handleClosePlayground = useCallback(() => setSelected(null), [])

  return (
    <>
      <DieCutDefs />
      <Library
        stickers={stickers}
        urls={urls}
        newId={newId}
        editing={editing}
        onEditingChange={setEditing}
        onOpen={setSelected}
        onCamera={openCamera}
        onReorder={handleReorder}
        onDelete={(ids) => void handleDeleteMany(ids)}
      />
      {cameraOpen && !shot && (
        <Camera onCapture={handleCapture} latestUrl={latestUrl} onClose={() => setCameraOpen(false)} />
      )}

      <AnimatePresence>
        {shot && (
          <Preview
            key="preview"
            imageUrl={shot.url}
            processing={shot.processing}
            cutoutFailed={shot.failed}
            onKeep={handleKeep}
            saving={keeping}
            onRetake={() => {
              keepingRef.current = false
              setKeeping(false)
              setShot(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <Playground
            key="playground"
            opened={selected}
            stickers={stickers}
            urls={urls}
            onClose={handleClosePlayground}
            onDelete={(s) => void handleDeleteMany([s.id])}
          />
        )}
      </AnimatePresence>

      {!shot && !selected && !editing && !cameraOpen && (
        <button className="fab pressable" aria-label="Open camera" onClick={openCamera}>
          <Icon name="camera" size={26} />
        </button>
      )}
    </>
  )
}
