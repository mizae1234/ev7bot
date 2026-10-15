// Shared client for the EV7 Core (iCare) API.
// The API is called from the browser (bypasses Cloudflare). URL/token are read at runtime from
// /api/config/ev7-core, which reads these server env vars (no rebuild needed when they change):
//   EV7_CORE_API_URL   e.g. https://api-aion.com7tracking.com/api/icare   (no trailing slash)
//   EV7_CORE_API_TOKEN Bearer token

/** Generic, user-facing message — configuration details must never reach the UI */
export const EV7_CORE_UNAVAILABLE_MESSAGE = 'ไม่สามารถเชื่อมต่อระบบ EV7 Core ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'

interface Ev7CoreConfig {
  url: string
  token: string
}

let configPromise: Promise<Ev7CoreConfig> | null = null

function loadConfig(): Promise<Ev7CoreConfig> {
  if (!configPromise) {
    configPromise = fetch('/api/config/ev7-core', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`config HTTP ${res.status}`)
        const cfg = (await res.json()) as Partial<Ev7CoreConfig>
        const url = (cfg.url || '').replace(/\/+$/, '')
        if (!url) throw new Error('EV7_CORE_API_URL is not configured')
        if (!cfg.token) throw new Error('EV7_CORE_API_TOKEN is not configured')
        return { url, token: cfg.token }
      })
      .catch((err) => {
        configPromise = null // retry next time
        console.error('[EV7 Core]', err instanceof Error ? err.message : err)
        throw new Error(EV7_CORE_UNAVAILABLE_MESSAGE)
      })
  }
  return configPromise
}

/** GET an EV7 Core endpoint with the Bearer token, e.g. ev7CoreGet('getCaseTaxi') */
export async function ev7CoreGet(endpoint: string, params?: Record<string, string | undefined>): Promise<Response> {
  const { url, token } = await loadConfig()

  const qs = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v) qs.append(k, v)
  })
  const query = qs.toString()

  return fetch(`${url}/${endpoint.replace(/^\/+/, '')}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}
