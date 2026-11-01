import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// Tiny PNG writer so icon generation needs no native image dependency.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function png(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const scanlines = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    scanlines[rowStart] = 0 // filter: none
    pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function makeIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
    pixels[i + 3] = a
  }
  const inRoundedRect = (x, y, left, top, right, bottom, radius) => {
    if (x < left || x >= right || y < top || y >= bottom) return false
    const nearestX = Math.max(left + radius, Math.min(x, right - radius - 1))
    const nearestY = Math.max(top + radius, Math.min(y, bottom - radius - 1))
    const dx = x - nearestX
    const dy = y - nearestY
    return dx * dx + dy * dy <= radius * radius
  }

  const blue = [29, 78, 216]
  const white = [255, 255, 255]
  const red = [220, 38, 38]
  const scale = size / 64

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let color = blue
      if (inRoundedRect(x, y, 13 * scale, 15 * scale, 51 * scale, 49 * scale, 5 * scale)) {
        color = white
        const line = (top, left, width) =>
          y >= top * scale &&
          y < (top + 3) * scale &&
          x >= left * scale &&
          x < (left + width) * scale
        if (line(23, 19, 26) || line(30, 19, 20) || line(37, 19, 14)) color = blue
      }
      const dx = x - 47 * scale
      const dy = y - 47 * scale
      if (dx * dx + dy * dy <= (7 * scale) ** 2) color = red
      set(x, y, [...color, 255])
    }
  }

  return png(size, size, pixels)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', makeIcon(192))
writeFileSync('public/icons/icon-512.png', makeIcon(512))
writeFileSync('public/apple-touch-icon.png', makeIcon(180))
console.log('Generated PWA icons in public/')
