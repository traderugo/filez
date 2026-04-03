import { jsPDF } from 'jspdf'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Fetch an image URL and return a base64 data URL.
 */
async function fetchImageAsBase64(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Get image dimensions from a data URL.
 */
function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 100, height: 100 })
    img.src = dataUrl
  })
}

/**
 * Export receipt images as a PDF — one receipt per page, actual image size on A4.
 * No captions, no title page.
 */
export async function exportImprestReceiptsPdf({ entries, month, year }) {
  const sorted = [...entries].sort((a, b) =>
    (a.entry_date || '').localeCompare(b.entry_date || '') || (a.created_at || '').localeCompare(b.created_at || '')
  )
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 10
  const usableW = pageW - margin * 2
  const usableH = pageH - margin * 2

  let isFirstPage = true

  for (const entry of sorted) {
    if (!isFirstPage) doc.addPage()
    isFirstPage = false

    try {
      const dataUrl = await fetchImageAsBase64(entry.receipt_image_url)
      const { width: pxW, height: pxH } = await getImageDimensions(dataUrl)

      // Convert pixel dimensions to mm at 96 DPI (1px = 0.2646mm)
      const mmW = pxW * 0.2646
      const mmH = pxH * 0.2646

      // Use actual size, but scale down only if it exceeds the usable area
      const scale = Math.min(usableW / mmW, usableH / mmH, 1)
      const imgW = mmW * scale
      const imgH = mmH * scale

      // Center on page
      const x = (pageW - imgW) / 2
      const y = (pageH - imgH) / 2

      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(dataUrl, format, x, y, imgW, imgH)
    } catch {
      doc.setFontSize(10)
      doc.text('(Image could not be loaded)', pageW / 2, pageH / 2, { align: 'center' })
    }
  }

  doc.save(`Imprest Receipts - ${MONTHS[month - 1]} ${year}.pdf`)
}
