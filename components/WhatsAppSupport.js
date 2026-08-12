import { MessageCircle } from 'lucide-react'
import { whatsAppLink } from '@/lib/support'
import { OUTLINE } from '@/components/ui'

/**
 * "Message us on WhatsApp", with the message prefilled.
 *
 * Exists because /auth/pending told a stranded user to "contact your administrator" and gave
 * them nothing to contact them with. A signup sat unnoticed for a long time partly for that
 * reason: the person had no way through, and nothing on this side surfaced them.
 *
 * Renders nothing when no number is configured, rather than a link that opens WhatsApp with
 * no recipient.
 */
export default function WhatsAppSupport({ message, label = 'Message us on WhatsApp', className = '' }) {
  const href = whatsAppLink(message)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400 ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      {label}
    </a>
  )
}
