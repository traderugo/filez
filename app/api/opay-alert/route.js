const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

function parseOPayMessage(text) {
  // Credit received
  const creditMatch = text.match(
    /You received ₦([\d,]+\.?\d*) from (.+?)\. It has been credited in your OPay account\. Total received today is ₦([\d,]+\.?\d*) \((\d+) transactions?\)/
  )
  if (creditMatch) {
    return {
      type: 'credit',
      amount: creditMatch[1],
      sender: creditMatch[2].trim(),
      dailyTotal: creditMatch[3],
      txCount: creditMatch[4],
    }
  }

  // Transfer sent
  const transferMatch = text.match(
    /Your transfer of ₦([\d,]+\.?\d*) to (.+?) has been confirmed by the recipient bank/
  )
  if (transferMatch) {
    return {
      type: 'transfer',
      amount: transferMatch[1],
      recipient: transferMatch[2].trim(),
    }
  }

  // Security alert
  if (text.includes('logged in on a new device')) {
    return { type: 'security', raw: text }
  }

  return null
}

function formatTelegramMessage(parsed) {
  if (!parsed) return null

  if (parsed.type === 'credit') {
    return (
      `💰 *CREDIT RECEIVED*\n` +
      `Amount: *₦${parsed.amount}*\n` +
      `From: ${parsed.sender}\n` +
      `Today's total: ₦${parsed.dailyTotal} (${parsed.txCount} transactions)`
    )
  }

  if (parsed.type === 'transfer') {
    return (
      `📤 *TRANSFER SENT*\n` +
      `Amount: *₦${parsed.amount}*\n` +
      `To: ${parsed.recipient}`
    )
  }

  if (parsed.type === 'security') {
    return `⚠️ *SECURITY ALERT*\n${parsed.raw}`
  }

  return null
}

async function sendToTelegram(message) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    }),
  })
  return res.ok
}

export async function POST(req) {
  try {
    const body = await req.json()
    const smsText = body.message || body.text || body.sms || ''

    if (!smsText) {
      return Response.json({ error: 'No message provided' }, { status: 400 })
    }

    const parsed = parseOPayMessage(smsText)
    if (!parsed) {
      return Response.json({ error: 'Unrecognized message format' }, { status: 422 })
    }

    const formatted = formatTelegramMessage(parsed)
    await sendToTelegram(formatted)

    return Response.json({ ok: true, type: parsed.type })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
