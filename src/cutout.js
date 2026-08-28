import { stickerCutout } from "./fallback-cutout.js";

export async function cutOutSticker(file, onProgress) {
  onProgress?.("cutout", 1, 1);
  return stickerCutout(file, 960);
}
