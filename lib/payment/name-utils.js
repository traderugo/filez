/**
 * Name normalization and similarity utilities for bank transfer verification.
 */

export function normalizeName(name) {
  if (!name) return ''
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,\-']/g, '')
    .trim()
}

export function calculateNameSimilarity(name1, name2) {
  const n1 = normalizeName(name1)
  const n2 = normalizeName(name2)

  if (!n1 || !n2) return 0
  if (n1 === n2) return 1.0

  if (n1.includes(n2) || n2.includes(n1)) return 0.9

  const words1 = n1.split(' ')
  const words2 = n2.split(' ')
  const shorter = words1.length <= words2.length ? words1 : words2
  const longer = words1.length > words2.length ? words1 : words2
  const matchingWords = shorter.filter(w => longer.includes(w))
  if (matchingWords.length === shorter.length && shorter.length >= 2) return 0.88

  const distance = levenshteinDistance(n1, n2)
  const maxLength = Math.max(n1.length, n2.length)
  return Math.max(0, 1 - distance / maxLength)
}

function levenshteinDistance(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}
