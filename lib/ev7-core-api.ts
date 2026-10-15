// Shared config for the EV7 Core (iCare) API.
// These endpoints are called from the browser (bypasses Cloudflare), so the values are inlined
// at build time via `env` in next.config.mjs — they must be set in .env / the build environment.
//   EV7_CORE_API_URL   e.g. https://api-aion.com7tracking.com/api/icare   (no trailing slash)
//   EV7_CORE_API_TOKEN Bearer token

const BASE_URL = (process.env.EV7_CORE_API_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.EV7_CORE_API_TOKEN || ''

/** Generic, user-facing message — configuration details must never reach the UI */
export const EV7_CORE_UNAVAILABLE_MESSAGE = 'ไม่สามารถเชื่อมต่อระบบ EV7 Core ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'

/** Full URL for an EV7 Core endpoint, e.g. ev7CoreUrl('getCaseTaxi') */
export function ev7CoreUrl(endpoint: string, params?: Record<string, string | undefined>): string {
  if (!BASE_URL) {
    console.error('[EV7 Core] EV7_CORE_API_URL is not configured')
    throw new Error(EV7_CORE_UNAVAILABLE_MESSAGE)
  }
  const qs = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v) qs.append(k, v)
  })
  const query = qs.toString()
  return `${BASE_URL}/${endpoint.replace(/^\/+/, '')}${query ? `?${query}` : ''}`
}

/** GET an EV7 Core endpoint with the Bearer token. Throws if URL/token are not configured. */
export function ev7CoreGet(endpoint: string, params?: Record<string, string | undefined>): Promise<Response> {
  if (!TOKEN) {
    console.error('[EV7 Core] EV7_CORE_API_TOKEN is not configured')
    throw new Error(EV7_CORE_UNAVAILABLE_MESSAGE)
  }
  return fetch(ev7CoreUrl(endpoint, params), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  })
}
