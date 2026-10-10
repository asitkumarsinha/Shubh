/** Drop a dark photo backdrop so the emblem sits on white and can scale to fit. */
export function fitLogoOnWhite(img: HTMLImageElement): string | null {
  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  if (!sourceWidth || !sourceHeight) return null;

  // The emblem is shown small. Working on a capped canvas keeps the crop accurate
  // without scanning a multi-megapixel photo on the main thread.
  const maxEdge = 720;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);

  let frame: ImageData;
  try {
    frame = ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }

  const data = frame.data;
  const count = width * height;
  const lum = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    const i = p * 4;
    lum[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0;
  }

  const cornerAvg = (lum[0] + lum[width - 1] + lum[(height - 1) * width] + lum[count - 1]) / 4;
  if (cornerAvg > 170) return null;

  const bright = 150;
  const seen = new Uint8Array(count);
  let bestStart = -1;
  let bestSize = 0;
  const stack: number[] = [];

  for (let start = 0; start < count; start++) {
    if (seen[start] || lum[start] < bright) continue;
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % width;
      const y = (p / width) | 0;
      if (x > 0 && !seen[p - 1] && lum[p - 1] >= bright) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (x + 1 < width && !seen[p + 1] && lum[p + 1] >= bright) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (y > 0 && !seen[p - width] && lum[p - width] >= bright) {
        seen[p - width] = 1;
        stack.push(p - width);
      }
      if (y + 1 < height && !seen[p + width] && lum[p + width] >= bright) {
        seen[p + width] = 1;
        stack.push(p + width);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestStart = start;
    }
  }

  if (bestStart < 0 || bestSize < 100) return null;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  stack.push(bestStart);
  const marked = new Uint8Array(count);
  marked[bestStart] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p / width) | 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (x > 0 && !marked[p - 1] && lum[p - 1] >= bright) {
      marked[p - 1] = 1;
      stack.push(p - 1);
    }
    if (x + 1 < width && !marked[p + 1] && lum[p + 1] >= bright) {
      marked[p + 1] = 1;
      stack.push(p + 1);
    }
    if (y > 0 && !marked[p - width] && lum[p - width] >= bright) {
      marked[p - width] = 1;
      stack.push(p - width);
    }
    if (y + 1 < height && !marked[p + width] && lum[p + width] >= bright) {
      marked[p + width] = 1;
      stack.push(p + width);
    }
  }

  // The emblem ring breaks into several bright patches; take in nearby bright pixels as well.
  for (let pass = 0; pass < 2; pass++) {
    const growX = Math.round((maxX - minX) * 0.12);
    const growY = Math.round((maxY - minY) * 0.12);
    const x0 = Math.max(0, minX - growX);
    const x1 = Math.min(width - 1, maxX + growX);
    const y0 = Math.max(0, minY - growY);
    const y1 = Math.min(height - 1, maxY + growY);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (lum[y * width + x] < bright) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW > width * 0.92 && boxH > height * 0.92) return null;

  const round = boxH / boxW > 0.6 && boxH / boxW < 1.4;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let rx = (boxW / 2) * 1.28;
  let ry = (boxH / 2) * 1.28;

  if (round) {
    rx = ry = (Math.max(boxW, boxH) / 2) * 1.05;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = round ? 0 : 255;
      }
    }
  }

  ctx.putImageData(frame, 0, 0);
  const pad = 36;

  if (round) {
    const side = Math.ceil(2 * rx) + pad * 2;
    const square = document.createElement('canvas');
    square.width = side;
    square.height = side;
    const squareCtx = square.getContext('2d');
    if (!squareCtx) return null;
    squareCtx.drawImage(canvas, Math.round(side / 2 - cx), Math.round(side / 2 - cy));
    return square.toDataURL('image/png');
  }

  const left = Math.max(0, Math.floor(cx - rx) - pad);
  const top = Math.max(0, Math.floor(cy - ry) - pad);
  const right = Math.min(width, Math.ceil(cx + rx) + pad);
  const bottom = Math.min(height, Math.ceil(cy + ry) + pad);

  const cropped = document.createElement('canvas');
  cropped.width = Math.max(1, right - left);
  cropped.height = Math.max(1, bottom - top);
  const cropCtx = cropped.getContext('2d');
  if (!cropCtx) return null;
  cropCtx.fillStyle = '#ffffff';
  cropCtx.fillRect(0, 0, cropped.width, cropped.height);
  cropCtx.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped.toDataURL('image/png');
}
