function sampleCorners(data, width, height) {
  const patches = [
    [0, 0],
    [width - 5, 0],
    [0, height - 5],
    [width - 5, height - 5],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [sx, sy] of patches) {
    for (let y = sy; y < sy + 5; y++) {
      for (let x = sx; x < sx + 5; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = (y * width + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

function nearBackground(data, i, bg, threshold) {
  const o = i * 4;
  const dr = data[o] - bg.r;
  const dg = data[o + 1] - bg.g;
  const db = data[o + 2] - bg.b;
  return dr * dr + dg * dg + db * db < threshold * threshold;
}

export async function edgeCutout(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const bg = sampleCorners(data, width, height);
  const visited = new Uint8Array(width * height);
  const stack = [];
  const threshold = 48;

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    visited[i] = 1;
    if (nearBackground(data, i, bg, threshold)) stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i / width) | 0;
    data[i * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  ctx.putImageData(image, 0, 0);
  const out = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Cutout failed"))),
      "image/png",
    );
  });
  return out;
}
