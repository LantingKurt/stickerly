import { get, set } from "idb-keyval";

const IDS_KEY = "pastely-ids";

function stickerKey(id) {
  return `pastely-sticker:${id}`;
}

export async function listStickers() {
  const ids = (await get(IDS_KEY)) ?? [];
  const items = await Promise.all(
    ids.map(async (entry) => {
      const id = typeof entry === "string" ? entry : entry.id;
      const createdAt =
        typeof entry === "object" && entry.createdAt ? entry.createdAt : 0;
      const blob = await get(stickerKey(id));
      return blob ? { id, createdAt, blob } : null;
    }),
  );
  return items.filter(Boolean);
}

export async function saveSticker(blob) {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const ids = (await get(IDS_KEY)) ?? [];
  await set(stickerKey(id), blob);
  await set(IDS_KEY, [{ id, createdAt }, ...ids]);
  return { id, createdAt, blob };
}
