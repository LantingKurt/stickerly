const MAX_EDGE = 1024;

let removeBackground = null;

async function loadImgly() {
  if (!removeBackground) {
    const mod = await import("@imgly/background-removal");
    removeBackground = mod.default;
  }
  return removeBackground;
}

async function resizeToMax(file, max = MAX_EDGE) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not resize photo"))),
      "image/jpeg",
      0.9,
    );
  });
  return blob;
}

export async function cutOutSticker(file, onProgress) {
  const small = await resizeToMax(file);
  const remove = await loadImgly();
  return remove(small, {
    device: "cpu",
    model: "isnet_quint8",
    output: { format: "image/png", type: "foreground" },
    progress: (key, current, total) => {
      if (onProgress && total) onProgress(key, current, total);
    },
  });
}
