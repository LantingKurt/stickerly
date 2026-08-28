import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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

export default function App() {
  const [tab, setTab] = useState<'camera' | 'library'>('camera')
  const [shot, setShot] = useState<Shot | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [selected, setSelected] = useState<Sticker | null>(null)
  const [newId, setNewId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const urlMap = useRef(new Map<string, string>())

  const refresh = useCallback(async () => setStickers(await listStickers()), [])
  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!newId) return
    const t = setTimeout(() => setNewId(null), 5000)
    return () => clearTimeout(t)
  }, [newId])

  const stickerKey = stickers.map((s) => s.id).sort().join()
  const urls = useMemo(() => {
    const prev = urlMap.current
    const live = new Set(stickers.map((s) => s.id))
    const next = new Map<string, string>()
    for (const s of stickers) {
      next.set(s.id, prev.get(s.id) ?? URL.createObjectURL(s.blob))
    }
    for (const [id, url] of prev) {
      if (!live.has(id)) URL.revokeObjectURL(url)
    }
    urlMap.current = next
    return next
  }, [stickerKey])

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
      setEditing(false)
    } catch (err) {
      console.error(err)
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
      {tab === 'camera' && !shot && <Camera onCapture={handleCapture} latestUrl={latestUrl} />}
      {tab === 'library' && (
        <Library
          stickers={stickers}
          urls={urls}
          newId={newId}
          editing={editing}
          onEditingChange={setEditing}
          onOpen={setSelected}
          onCamera={() => setTab('camera')}
          onReorder={handleReorder}
          onDelete={(ids) => void handleDeleteMany(ids)}
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

      {!shot && !selected && !editing && (
        <nav className="tabbar">
          {(['library', 'camera'] as const).map((t) => (
            <button
              key={t}
              className={`tab pressable ${tab === t ? 'active' : ''}`}
              onClick={() => {
                setTab(t)
                setEditing(false)
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
