import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import archiver from 'archiver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CDN_URL = (
  process.env.NEXT_PUBLIC_SPACES_CDN_URL || 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'
).replace(/\/+$/, '')

// Only PLMV (insurance) and PLMC (act) PDFs may be bundled; keeps this endpoint from being an open proxy.
const PREFIX_BY_TYPE = {
  PLMV: 'Policies/Insurance/',
  PLMC: 'Policies/Act/'
} as const
type DocType = keyof typeof PREFIX_BY_TYPE
const MAX_FILES = 100
const CONCURRENCY = 5
const FETCH_TIMEOUT_MS = 30_000

interface ZipItem {
  vinNo: string
  registerNo?: string | null
  path: string
}

/** Resolve a stored path to a CDN URL, or null when it is outside the whitelist. */
function resolveUrl(path: string, allowedPrefix: string): string | null {
  let key = path.trim()
  if (/^https?:\/\//i.test(key)) {
    try {
      const u = new URL(key)
      if (u.origin !== new URL(CDN_URL).origin) return null
      key = decodeURIComponent(u.pathname).replace(/^\/+/, '')
    } catch {
      return null
    }
  } else {
    key = key.replace(/^\/+/, '')
  }
  if (!key.startsWith(allowedPrefix) || key.includes('..')) return null
  return `${CDN_URL}/${key.split('/').map(encodeURIComponent).join('/')}`
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\r\n]+/g, '_').trim()

export async function POST(request: NextRequest) {
  let items: ZipItem[]
  let docType: DocType
  try {
    const body = await request.json()
    items = Array.isArray(body?.items) ? body.items : []
    docType = body?.type === 'PLMC' ? 'PLMC' : 'PLMV'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'ไม่มีรายการไฟล์ที่จะดาวน์โหลด' }, { status: 400 })
  }
  if (items.length > MAX_FILES) {
    return NextResponse.json({ error: `ดาวน์โหลดได้สูงสุด ${MAX_FILES} ไฟล์ต่อครั้ง` }, { status: 400 })
  }

  const jobs: { name: string; url: string }[] = []
  const usedNames = new Set<string>()
  for (const it of items) {
    if (!it || typeof it.path !== 'string' || typeof it.vinNo !== 'string') {
      return NextResponse.json({ error: 'รูปแบบรายการไม่ถูกต้อง' }, { status: 400 })
    }
    const url = resolveUrl(it.path, PREFIX_BY_TYPE[docType])
    if (!url) {
      return NextResponse.json({ error: `path ไม่อนุญาต: ${it.vinNo}` }, { status: 400 })
    }
    // Keep the stored file name (it already contains the VIN); de-duplicate on collision.
    const base = safeName(decodeURIComponent(url.split('/').pop() || '')) || `${safeName(it.vinNo)}.pdf`
    const dot = base.lastIndexOf('.')
    const stem = dot > 0 ? base.slice(0, dot) : base
    const ext = dot > 0 ? base.slice(dot) : ''
    let name = base
    let n = 2
    while (usedNames.has(name)) name = `${stem}_${n++}${ext}`
    usedNames.add(name)
    jobs.push({ name, url })
  }

  const archive = archiver('zip', { zlib: { level: 0 } }) // PDFs are already compressed
  const errors: string[] = []

  ;(async () => {
    let cursor = 0
    const worker = async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++]
        try {
          const res = await fetch(job.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          archive.append(Buffer.from(await res.arrayBuffer()), { name: job.name })
        } catch (err) {
          errors.push(`${job.name}: ${err instanceof Error ? err.message : 'download failed'}`)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker))
    if (errors.length > 0) {
      archive.append(errors.join('\n'), { name: '_errors.txt' })
    }
    await archive.finalize()
  })().catch(err => archive.destroy(err instanceof Error ? err : new Error(String(err))))

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${docType}_${stamp}.zip"`,
      'Cache-Control': 'no-store'
    }
  })
}
