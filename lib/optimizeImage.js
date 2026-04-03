/**
 * Client-side image optimization using Canvas API.
 * Resizes to max dimensions, converts to WebP, strips EXIF metadata.
 *
 * @param {File} file - Original image file
 * @param {object} options
 * @param {number} options.maxWidth - Max width in px (default 1200)
 * @param {number} options.maxHeight - Max height in px (default 1200)
 * @param {number} options.quality - WebP quality 0-1 (default 0.8)
 * @returns {Promise<File>} Optimized file
 */
export async function optimizeImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = {}) {
  // Skip non-images (e.g. PDFs)
  if (!file.type.startsWith('image/')) return file

  // Skip small files (< 50KB) — already tiny
  if (file.size < 50 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)

      let { width, height } = img
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file)
            return
          }
          const optimized = new File([blob], file.name.replace(/\.\w+$/, '.webp'), {
            type: 'image/webp',
            lastModified: Date.now(),
          })
          resolve(optimized)
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve(file)
    }
    img.src = URL.createObjectURL(file)
  })
}
