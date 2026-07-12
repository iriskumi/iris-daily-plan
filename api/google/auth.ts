/// <reference types="node" />

import crypto from 'node:crypto'

interface VercelRequest {
  method?: string
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
  end: (body?: string) => void
}

interface GoogleConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const GOOGLE_OAUTH_SCOPE = `${CALENDAR_SCOPE} ${CALENDAR_EVENTS_SCOPE} ${GMAIL_SCOPE} openid email`
const STATE_COOKIE = 'iris_google_calendar_state'

function getDiagnostic() {
  return {
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasGoogleRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
  }
}

function requiredGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return null
  return { clientId, clientSecret, redirectUri }
}

function createCookie(
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

function sendJson(res: VercelResponse, body: unknown, status = 200): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== 'GET') {
      sendJson(res, {
        success: false,
        message: 'Method not allowed',
        diagnostic: getDiagnostic(),
        data: null,
      }, 405)
      return
    }

    const config = requiredGoogleConfig()
    if (!config) {
      sendJson(res, {
        success: false,
        message:
          'Google Calendar OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
        diagnostic: getDiagnostic(),
        data: null,
      })
      return
    }

    const state = crypto.randomUUID()
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: GOOGLE_OAUTH_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    res.setHeader('Set-Cookie', createCookie(STATE_COOKIE, state, { maxAgeSeconds: 10 * 60 }))
    res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
    res.status(302).end()
  } catch {
    sendJson(res, {
      success: false,
      message: 'Google Calendar OAuth route failed before redirect',
      diagnostic: getDiagnostic(),
      data: null,
    })
  }
}
