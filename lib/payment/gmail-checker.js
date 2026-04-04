/**
 * Gmail integration for reading Moniepoint bank alert emails.
 * Reads credit alerts, extracts sender name, amount, and date.
 */

import { google } from 'googleapis'
import { simpleParser } from 'mailparser'

async function getGmailClient() {
  const credentialsB64 = process.env.GMAIL_CREDENTIALS_BASE64
  const tokenB64 = process.env.GMAIL_TOKEN_BASE64

  if (!credentialsB64 || !tokenB64) {
    throw new Error('Gmail API credentials not configured')
  }

  const credentials = JSON.parse(Buffer.from(credentialsB64, 'base64').toString())
  const token = JSON.parse(Buffer.from(tokenB64, 'base64').toString())

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0])
  oAuth2Client.setCredentials(token)

  if (!token.refresh_token) {
    console.warn('Gmail token has no refresh_token — token cannot be refreshed if expired')
  }

  return google.gmail({ version: 'v1', auth: oAuth2Client })
}

/**
 * Parse Moniepoint credit alert email body.
 */
function parsePaymentEmail(emailBody) {
  if (!emailBody) return null

  const amountMatch = emailBody.match(/Credit Amount\s*[\s\S]*?([\d,]+\.?\d*)/i)
    || emailBody.match(/Amount[:\s]*([\d,]+\.?\d*)/i)
    || emailBody.match(/NGN\s*([\d,]+\.?\d*)/i)

  const senderMatch = emailBody.match(/Sender'?s?\s*Name[:\s]*(?:from\s+)?(.+?)(?:\n|$)/i)
    || emailBody.match(/From[:\s]*(.+?)(?:\n|$)/i)

  const dateMatch = emailBody.match(/Date\s*&?\s*Time[:\s]*(.+?)(?:\n|$)/i)
    || emailBody.match(/Transaction Date[:\s]*(.+?)(?:\n|$)/i)

  if (!amountMatch || !senderMatch) return null

  const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
  const senderName = senderMatch[1].trim()

  let parsedDate = new Date()
  if (dateMatch) {
    try {
      parsedDate = new Date(dateMatch[1].trim().replace(' | ', ' '))
    } catch {
      // fallback to now
    }
  }

  return { amount, senderName, date: parsedDate }
}

/**
 * Fetch recent unread credit alert emails from Gmail.
 * Returns array of { amount, senderName, date, messageId }.
 */
export async function checkBankAlerts() {
  const gmail = await getGmailClient()

  const query = 'from:no-reply@moniepoint.com subject:credit is:unread'

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 20,
  })

  const messages = res.data.messages || []
  const results = []

  for (const message of messages) {
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'raw',
      })

      const emailData = Buffer.from(msg.data.raw, 'base64').toString()
      const parsed = await simpleParser(emailData)
      const paymentData = parsePaymentEmail(parsed.text || '')

      if (paymentData) {
        results.push({ ...paymentData, messageId: message.id })
      }
    } catch (error) {
      console.error(`Error processing Gmail message ${message.id}:`, error.message)
    }
  }

  return results
}

/**
 * Mark a Gmail message as read after successful verification.
 */
export async function markAsRead(messageId) {
  const gmail = await getGmailClient()
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}
