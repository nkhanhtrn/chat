/**
 * Extract the dominant color from an image URL
 * @param {string} imageUrl - The URL of the image
 * @returns {Promise<{h: number, s: number, l: number}>} HSL color values
 */
export async function extractDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const color = getAverageColor(img)
        resolve(color)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = imageUrl
  })
}

/**
 * Get the average color from an image element
 * @param {HTMLImageElement} img - The image element
 * @returns {{h: number, s: number, l: number}} HSL color values
 */
function getAverageColor(img) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Use small dimensions for performance
  const maxSize = 50
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
  canvas.width = img.width * scale
  canvas.height = img.height * scale

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let r = 0, g = 0, b = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    // Skip transparent pixels
    if (data[i + 3] < 128) continue

    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }

  if (count === 0) {
    return { h: 0, s: 0, l: 100 } // Default to white
  }

  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)

  return rgbToHsl(r, g, b)
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {{h: number, s: number, l: number}} HSL color values
 */
function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Generate a color from text (for default covers)
 * @param {string} text - The text to generate color from
 * @returns {{h: number, s: number, l: number}} HSL color values
 */
export function generateColorFromText(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }

  const h = Math.abs(hash % 360)
  const s = 40 + (Math.abs(hash >> 8) % 40) // 40-80% saturation
  const l = 35 + (Math.abs(hash >> 16) % 25) // 35-60% lightness

  return { h, s, l }
}
