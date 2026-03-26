import { jsPDF } from 'jspdf'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

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
 * Export receipt images as a PDF in chronological order.
 * Each receipt gets its own page with a caption (date, beneficiary, amount).
 */
export async function exportImprestReceiptsPdf({ entries, month, year, custodianName }) {
  const sorted = [...entries].sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || ''))
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 15
  const usableW = pageW - margin * 2
  const usableH = pageH - margin * 2 - 30 // reserve space for caption

  // Title page
  doc.setFontSize(18)
  doc.text('Imprest Receipts', pageW / 2, 40, { align: 'center' })
  doc.setFontSize(14)
  doc.text(`${MONTHS[month - 1]} ${year}`, pageW / 2, 52, { align: 'center' })
  if (custodianName) {
    doc.setFontSize(11)
    doc.text(`Custodian: ${custodianName}`, pageW / 2, 64, { align: 'center' })
  }
  doc.setFontSize(10)
  doc.text(`${sorted.length} receipt(s)`, pageW / 2, 76, { align: 'center' })

  for (const entry of sorted) {
    doc.addPage()

    // Caption at top
    doc.setFontSize(10)
    const caption = `${fmtDateShort(entry.entry_date)}  |  ${entry.beneficiary}  |  ₦${Number(entry.amount || 0).toLocaleString()}`
    doc.text(caption, margin, margin + 5)
    if (entry.transaction_details) {
      doc.setFontSize(9)
      doc.text(entry.transaction_details, margin, margin + 11)
    }

    const imgTop = margin + 18

    try {
      const dataUrl = await fetchImageAsBase64(entry.receipt_image_url)
      const { width, height } = await getImageDimensions(dataUrl)

      // Scale to fit
      const ratio = Math.min(usableW / width, usableH / height, 1)
      const imgW = width * ratio
      const imgH = height * ratio

      // Center horizontally
      const x = margin + (usableW - imgW) / 2

      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(dataUrl, format, x, imgTop, imgW, imgH)
    } catch (err) {
      doc.setFontSize(10)
      doc.text('(Image could not be loaded)', pageW / 2, imgTop + 20, { align: 'center' })
    }
  }

  doc.save(`Imprest Receipts - ${MONTHS[month - 1]} ${year}.pdf`)
}
