/**
 * The support WhatsApp number, and how to build a link to it.
 *
 * Overridable by NEXT_PUBLIC_SUPPORT_WHATSAPP so it can change without a deploy, with the
 * current number as the default. A default rather than env-only on purpose: .env files are
 * gitignored here, so an env-only value would be missing on any deploy where nobody had
 * remembered to set it, and the button would silently vanish from the one screen whose whole
 * job is giving a stranded user a way to reach someone.
 */
const DEFAULT_SUPPORT_WHATSAPP = '09051702146'

/**
 * wa.me wants digits only, in international form: no plus, no spaces, no leading zero.
 *
 * Nigerian numbers get written every which way (09051702146, 2349051702146, +234 905 170 2146),
 * so normalise rather than trust the input. A local 0XXXXXXXXXX becomes 234XXXXXXXXXX; anything
 * already carrying a country code is left as it is.
 */
export function normaliseWhatsApp(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return `234${digits.slice(1)}`
  // 10 digits with no leading zero is a Nigerian number missing both, e.g. 9051702146.
  if (digits.length === 10) return `234${digits}`
  return digits
}

export const SUPPORT_WHATSAPP = normaliseWhatsApp(
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_SUPPORT_WHATSAPP
)

/**
 * A wa.me deep link, with the message prefilled. Returns null when there is no number, so a
 * caller can render nothing rather than a link that opens WhatsApp with no recipient.
 */
export function whatsAppLink(message = '') {
  if (!SUPPORT_WHATSAPP) return null
  const base = `https://wa.me/${SUPPORT_WHATSAPP}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
