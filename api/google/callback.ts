/// <reference types="node" />

import {
  CALENDAR_SCOPE,
  STATE_COOKIE,
  TOKEN_COOKIE,
  clearCookie,
  createCookie,
  encryptTokens,
  getCookie,
  redirect,
  requiredGoogleConfig,
  type GoogleTokens,
  type VercelRequest,
  type VercelResponse,
} from '../../server/google.js'

function getRequestUrl(req: VercelRequest): URL {
  const hostHeader = req.headers?.['x-forwarded-host'] ?? req.headers?.host ?? 'localhost'
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const protoHeader = req.headers?.['x-forwarded-proto'] ?? 'https'
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
  return new URL(req.url ?? '/api/google/callback', `${proto}://${host}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const config = requiredGoogleConfig()
  if (!config) {
    res.status(500).json({
      success: false,
      message:
        'Google Calendar OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
      data: null,
    })
    return
  }

  const url = getRequestUrl(req)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = getCookie(req, STATE_COOKIE)
  const appRedirect = '/?googleCalendar=connected'
  const errorRedirect = '/?googleCalendar=error'

  if (!code || !state || !storedState || state !== storedState) {
    redirect(res, errorRedirect, [clearCookie(STATE_COOKIE)])
    return
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  })

  if (!tokenResponse.ok) {
    redirect(res, errorRedirect, [clearCookie(STATE_COOKIE)])
    return
  }

  const payload = (await tokenResponse.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }

  if (!payload.access_token || !payload.expires_in) {
    redirect(res, errorRedirect, [clearCookie(STATE_COOKIE)])
    return
  }

  const tokens: GoogleTokens = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + payload.expires_in * 1000,
    scope: payload.scope ?? CALENDAR_SCOPE,
    token_type: payload.token_type,
  }

  redirect(res, appRedirect, [
    clearCookie(STATE_COOKIE),
    createCookie(TOKEN_COOKIE, encryptTokens(tokens, config.clientSecret), {
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  ])
}
