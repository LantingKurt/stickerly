import { createStore, set, get, del, values } from 'idb-keyval'

export interface Sticker {
  id: string
  createdAt: number
  blob: Blob
}

const store = createStore('pastely', 'stickers')

export async function saveSticker(blob: Blob): Promise<Sticker> {
  const sticker: Sticker = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    blob,
  }
  await set(sticker.id, sticker, store)
  return sticker
}

export async function listStickers(): Promise<Sticker[]> {
  const all = (await values(store)) as Sticker[]
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteSticker(id: string): Promise<void> {
  await del(id, store)
}

export async function getSticker(id: string): Promise<Sticker | undefined> {
  return get(id, store)
}
