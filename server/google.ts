/// <reference types="node" />

import crypto from 'node:crypto'

export interface VercelRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
  end: (body?: string) => void
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  scope?: string
  token_type?: string
  account_email?: string
}

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const GOOGLE_OAUTH_SCOPE = `${CALENDAR_SCOPE} ${CALENDAR_EVENTS_SCOPE} ${GMAIL_SCOPE} openid email`
export const TOKEN_COOKIE = 'iris_google_calendar_tokens'
export const STATE_COOKIE = 'iris_google_calendar_state'
export const TOKEN_STORAGE_WARNING =
  'Google Calendar tokens are stored in an encrypted HttpOnly cookie for this local/dev-safe version. Production token storage should use a database-backed session store.'

export function requiredGoogleConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return null
  return { clientId, clientSecret, redirectUri }
}

export function getCookie(req: VercelRequest, name: string): string | null {
  const rawHeader = req.headers?.cookie
  const raw = Array.isArray(rawHeader) ? rawHeader.join('; ') : rawHeader
  if (!raw) return null
  const cookies = raw.split(';').map(part => part.trim())
  const prefix = `${name}=`
  const match = cookies.find(cookie => cookie.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : null
}

export function createCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds?: number; httpOnly?: boolean } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax']
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  if (typeof options.maxAgeSeconds === 'number') parts.push(`Max-Age=${options.maxAgeSeconds}`)
  return parts.join('; ')
}

export function clearCookie(name: string): string {
  return createCookie(name, '', { maxAgeSeconds: 0 })
}

function getEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptTokens(tokens: GoogleTokens, secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url')
}

export function decryptTokens(value: string, secret: string): GoogleTokens | null {
  try {
    const payload = Buffer.from(value, 'base64url')
    const iv = payload.subarray(0, 12)
    const authTag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return JSON.parse(decrypted) as GoogleTokens
  } catch {
    return null
  }
}

export async function refreshAccessToken(
  tokens: GoogleTokens,
  config: { clientId: string; clientSecret: string },
): Promise<GoogleTokens | null> {
  if (!tokens.refresh_token) return null
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const refreshed = (await response.json()) as {
    access_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }
  if (!refreshed.access_token || !refreshed.expires_in) return null
  return {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope ?? tokens.scope,
    token_type: refreshed.token_type ?? tokens.token_type,
  }
}

export function redirect(res: VercelResponse, location: string, cookies: string[] = []): void {
  if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)
  res.setHeader('Location', location)
  res.status(302).end()
}
