import { supabase } from './supabase'

export interface Sticker {
  id: string
  createdAt: number
  sortOrder: number
  blob: Blob
}

interface StickerRow {
  id: number
  created_at: string
  sort_order: number
  png: string
}

const STICKER_COLS = 'id, created_at, sort_order, png'

function blobToPng(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') {
        reject(new Error('Could not read sticker'))
        return
      }
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read sticker'))
    reader.readAsDataURL(blob)
  })
}

function pngToBlob(png: string): Blob {
  const raw = png.includes(',') ? png.slice(png.indexOf(',') + 1) : png
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/png' })
}

function toSticker(row: StickerRow): Sticker {
  return {
    id: String(row.id),
    createdAt: Date.parse(row.created_at),
    sortOrder: row.sort_order,
    blob: pngToBlob(row.png),
  }
}

export async function saveSticker(blob: Blob): Promise<Sticker> {
  const png = await blobToPng(blob)
  const { data: first, error: headError } = await supabase
    .from('stickers')
    .select('sort_order')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (headError) throw new Error(headError.message)
  const sort_order = (first?.sort_order ?? 1) - 1
  const { data, error } = await supabase
    .from('stickers')
    .insert({ png, sort_order })
    .select(STICKER_COLS)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not save sticker')
  return toSticker(data)
}

export async function listStickers(): Promise<Sticker[]> {
  const { data, error } = await supabase
    .from('stickers')
    .select(STICKER_COLS)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSticker)
}

export async function deleteSticker(id: string): Promise<void> {
  await deleteStickers([id])
}

export async function deleteStickers(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('stickers').delete().in('id', ids.map(Number))
  if (error) throw new Error(error.message)
}

export async function reorderStickers(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, i) => supabase.from('stickers').update({ sort_order: i }).eq('id', Number(id))),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)
}

export async function getSticker(id: string): Promise<Sticker | undefined> {
  const { data, error } = await supabase
    .from('stickers')
    .select(STICKER_COLS)
    .eq('id', Number(id))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toSticker(data) : undefined
}
