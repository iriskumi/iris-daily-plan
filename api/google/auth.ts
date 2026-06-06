/// <reference types="node" />

import crypto from 'node:crypto'
import {
  CALENDAR_SCOPE,
  STATE_COOKIE,
  createCookie,
  redirect,
  requiredGoogleConfig,
  type VercelRequest,
  type VercelResponse,
} from '../../server/google.js'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed', data: null })
    return
  }

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

  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, [
    createCookie(STATE_COOKIE, state, { maxAgeSeconds: 10 * 60 }),
  ])
}
