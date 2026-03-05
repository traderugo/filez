import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'pin_session'
const SESSION_DURATION_DAYS = 30

function getSecret() {
  const key = process.env.PIN_SESSION_SECRET
  if (!key) throw new Error('PIN_SESSION_SECRET env var is required')
  return new TextEncoder().encode(key)
}

export async function createSessionToken(userId) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret())
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.sub || null
  } catch {
    return null
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  }
}

export { COOKIE_NAME }
