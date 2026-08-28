import { supabase } from './supabase'

export interface Sticker {
  id: string
  createdAt: number
  blob: Blob
}

interface StickerRow {
  id: number
  created_at: string
  png: string
}

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
    blob: pngToBlob(row.png),
  }
}

export async function saveSticker(blob: Blob): Promise<Sticker> {
  const png = await blobToPng(blob)
  const { data, error } = await supabase
    .from('stickers')
    .insert({ png })
    .select('id, created_at, png')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not save sticker')
  return toSticker(data)
}

export async function listStickers(): Promise<Sticker[]> {
  const { data, error } = await supabase
    .from('stickers')
    .select('id, created_at, png')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSticker)
}

export async function deleteSticker(id: string): Promise<void> {
  const { error } = await supabase.from('stickers').delete().eq('id', Number(id))
  if (error) throw new Error(error.message)
}

export async function getSticker(id: string): Promise<Sticker | undefined> {
  const { data, error } = await supabase
    .from('stickers')
    .select('id, created_at, png')
    .eq('id', Number(id))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toSticker(data) : undefined
}
