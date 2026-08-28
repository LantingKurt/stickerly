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

function floodBackground(data, width, height, local, global, seed) {
  const bg = borderMedian(data, width, height);
  const mask = new Uint8Array(width * height);
  const stack = [];
  const localT2 = local * local;
  const globalT2 = global * global;
  const seedT2 = seed * seed;

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
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let start = 0; start < bgMask.length; start++) {
    if (bgMask[start] || seen[start]) continue;
    const q = [start];
    seen[start] = 1;
    const cells = [];
    while (q.length) {
      const cur = q.pop();
      cells.push(cur);
      const x = cur % width;
      const y = (cur / width) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
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
        if (cur[i - 1] && cur[i + 1] && cur[i - width] && cur[i + width]) {
          next[i] = 1;
        }
      }
    }
    cur = next;
  }
  return cur;
}

function blurAlpha(src, width, height, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        sum += src[y * width + xx];
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
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return image;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
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

function canvasPng(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG"))),
      "image/png",
    );
  });
}

async function readScaled(file, maxEdge) {
  let source = null;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = null;
  }
  if (!source) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Could not read photo"));
        img.src = url;
      });
      await img.decode?.().catch(() => {});
      source = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close();
  return ctx.getImageData(0, 0, width, height);
}

function extractMask(image, local, global, seed) {
  const bgMask = floodBackground(
    image.data,
    image.width,
    image.height,
    local,
    global,
    seed,
  );
  return keepLargest(bgMask, image.width, image.height);
}

function countOpaque(fg) {
  let n = 0;
  for (let i = 0; i < fg.length; i++) n += fg[i];
  return n;
}

export async function stickerCutout(file, maxEdge = 960) {
  const image = await readScaled(file, maxEdge);
  const area = image.width * image.height;
  const attempts = [
    [38, 62, 78],
    [28, 44, 52],
    [22, 34, 40],
  ];

  let fg = null;
  let opaque = 0;
  for (const [local, global, seed] of attempts) {
    fg = extractMask(image, local, global, seed);
    opaque = countOpaque(fg);
    if (opaque >= area * 0.02 && opaque <= area * 0.92) break;
  }

  if (!fg || opaque < area * 0.015) {
    return canvasPng(image);
  }

  const radius = opaque < area * 0.08 ? 1 : 2;
  fg = erode(fg, image.width, image.height, radius);
  if (countOpaque(fg) < area * 0.008) {
    return canvasPng(image);
  }

  const alpha = new Uint8Array(fg.length);
  for (let i = 0; i < fg.length; i++) alpha[i] = fg[i] ? 255 : 0;
  const soft = blurAlpha(alpha, image.width, image.height, 2);
  return canvasPng(cropToAlpha(image, soft, 12));
}
