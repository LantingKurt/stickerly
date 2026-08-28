const LOCAL = 38;
const GLOBAL = 62;
const SEED = 78;
const ERODE = 2;
const BLUR = 2;
const PAD = 12;

function dist2(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function medianChannel(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

function borderMedian(data, width, height) {
  const rs = [];
  const gs = [];
  const bs = [];
  const band = Math.max(4, Math.round(Math.min(width, height) * 0.02));
  const take = (x, y) => {
    const o = (y * width + x) * 4;
    rs.push(data[o]);
    gs.push(data[o + 1]);
    bs.push(data[o + 2]);
  };
  for (let x = 0; x < width; x++) {
    for (let t = 0; t < band; t++) {
      take(x, t);
      take(x, height - 1 - t);
    }
  }
  for (let y = band; y < height - band; y++) {
    for (let t = 0; t < band; t++) {
      take(t, y);
      take(width - 1 - t, y);
    }
  }
  return { r: medianChannel(rs), g: medianChannel(gs), b: medianChannel(bs) };
}

function floodBackground(data, width, height) {
  const bg = borderMedian(data, width, height);
  const mask = new Uint8Array(width * height);
  const stack = [];
  const localT2 = LOCAL * LOCAL;
  const globalT2 = GLOBAL * GLOBAL;
  const seedT2 = SEED * SEED;

  const trySeed = (x, y) => {
    const i = y * width + x;
    if (mask[i]) return;
    const o = i * 4;
    if (dist2(data[o], data[o + 1], data[o + 2], bg.r, bg.g, bg.b) <= seedT2) {
      mask[i] = 1;
      stack.push(i);
    }
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  const consider = (x, y, pr, pg, pb) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (mask[i]) return;
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    if (
      dist2(r, g, b, pr, pg, pb) <= localT2 ||
      dist2(r, g, b, bg.r, bg.g, bg.b) <= globalT2
    ) {
      mask[i] = 1;
      stack.push(i);
    }
  };

  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    const x = i % width;
    const y = (i / width) | 0;
    consider(x + 1, y, data[o], data[o + 1], data[o + 2]);
    consider(x - 1, y, data[o], data[o + 1], data[o + 2]);
    consider(x, y + 1, data[o], data[o + 1], data[o + 2]);
    consider(x, y - 1, data[o], data[o + 1], data[o + 2]);
  }

  return mask;
}

function keepLargest(bgMask, width, height) {
  const fg = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  let best = [];
  for (let i = 0; i < bgMask.length; i++) {
    if (bgMask[i] || seen[i]) continue;
    const q = [i];
    seen[i] = 1;
    const cells = [];
    while (q.length) {
      const cur = q.pop();
      cells.push(cur);
      const x = cur % width;
      const y = (cur / width) | 0;
      const nbs = [cur + 1, cur - 1, cur + width, cur - width];
      for (const n of nbs) {
        const nx = n % width;
        const ny = (n / width) | 0;
        if (n < 0 || n >= bgMask.length) continue;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        if (bgMask[n] || seen[n]) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    if (cells.length > best.length) best = cells;
  }
  for (const i of best) fg[i] = 1;
  return fg;
}

function erode(fg, width, height, radius) {
  let cur = fg;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!cur[i]) continue;
        if (
          cur[i - 1] &&
          cur[i + 1] &&
          cur[i - width] &&
          cur[i + width]
        ) {
          next[i] = 1;
        }
      }
    }
    cur = next;
  }
  return cur;
}

function blurAlpha(alpha, width, height, radius) {
  const tmp = new Float32Array(alpha.length);
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        sum += alpha[y * width + xx];
        n++;
      }
      tmp[y * width + x] = sum / n;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        sum += tmp[yy * width + x];
        n++;
      }
      out[y * width + x] = Math.round(sum / n);
    }
  }
  return out;
}

function cropToAlpha(image, alpha, pad) {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return image;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((minY + y) * width + (minX + x)) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = alpha[(minY + y) * width + (minX + x)];
    }
  }
  return out;
}

async function canvasPng(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Cutout failed"))),
      "image/png",
    );
  });
}

async function readScaled(file, maxEdge) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Could not read photo"));
      img.src = url;
    });
    await img.decode?.().catch(() => {});
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function stickerCutout(file, maxEdge = 960) {
  const image = await readScaled(file, maxEdge);
  const bgMask = floodBackground(image.data, image.width, image.height);
  let fg = keepLargest(bgMask, image.width, image.height);
  const opaque = fg.reduce((n, v) => n + v, 0);
  if (opaque < image.width * image.height * 0.01) {
    throw new Error("Could not find a sticker");
  }
  fg = erode(fg, image.width, image.height, ERODE);
  const alpha = blurAlpha(fg.map((v) => (v ? 255 : 0)), image.width, image.height, BLUR);
  const cropped = cropToAlpha(image, alpha, PAD);
  return canvasPng(cropped);
}
