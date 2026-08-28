import { cropToOpaque } from './stickerSvg'

// On-device background removal. Model assets are fetched once from the
// jsDelivr CDN and cached by the browser; inference runs locally (WASM).
// Throws on failure — caller falls back to the original photo so the
// demo loop never dead-ends.
export async function cutoutSticker(photo: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  const cut = await removeBackground(photo, {
    output: { format: 'image/png', quality: 1 },
  })
  return cropToOpaque(cut)
}
