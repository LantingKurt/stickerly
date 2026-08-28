import { stickerCutout } from "./fallback-cutout.js";

const MAX_EDGE = 1024;

let removeBackground = null;

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function forceSingleThread() {
  try {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => 1,
    });
  } catch {
    // Safari can throw if the property is locked.
  }
}

function polyfillConvertToBlob() {
  const add = (proto) => {
    if (!proto || proto.convertToBlob) return;
    proto.convertToBlob = function convertToBlob(opts = {}) {
      return new Promise((resolve, reject) => {
        this.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Could not encode image")),
          opts.type,
          opts.quality,
        );
      });
    };
  };
  add(HTMLCanvasElement.prototype);
  if (typeof OffscreenCanvas !== "undefined") add(OffscreenCanvas.prototype);
}

async function loadImgly() {
  if (!removeBackground) {
    const mod = await import("@imgly/background-removal");
    removeBackground = mod.default;
  }
  return removeBackground;
}

async function drawFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Could not read photo"));
      img.src = url;
    });
    await img.decode?.().catch(() => {});
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function resizeToMax(file, max) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await drawFile(file);
  }

  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  const scale = Math.min(1, max / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Could not resize photo")),
      "image/jpeg",
      0.85,
    );
  });
}

export async function cutOutSticker(file, onProgress) {
  forceSingleThread();
  polyfillConvertToBlob();

  if (isIos()) {
    onProgress?.("cutout", 1, 1);
    return stickerCutout(file, 960);
  }

  const small = await resizeToMax(file, MAX_EDGE);
  try {
    const remove = await loadImgly();
    return await Promise.race([
      remove(small, {
        device: "cpu",
        model: "small",
        proxyToWorker: false,
        publicPath:
          "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
        output: { format: "image/png" },
        progress: (key, current, total) => {
          if (onProgress && total) onProgress(key, current, total);
        },
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Cutout timed out")), 90_000);
      }),
    ]);
  } catch (err) {
    console.warn("On-device model failed, using edge cutout", err);
    return stickerCutout(file, 960);
  }
}
