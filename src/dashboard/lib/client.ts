'use client'
/** Browser-side helpers: the dashboard writes through Payload's REST API with the session cookie. */

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function messageFrom(data: unknown, status: number): string {
  const d = data as { errors?: { message?: string; data?: { errors?: { message?: string; label?: string }[] } }[]; message?: string; error?: string }
  const first = d?.errors?.[0]
  const fieldErr = first?.data?.errors?.[0]
  if (fieldErr?.message) return `${fieldErr.label ? fieldErr.label + ': ' : ''}${fieldErr.message}`
  if (first?.message) return first.message
  if (d?.error) return d.error
  if (d?.message) return d.message
  if (status === 401 || status === 403) return 'Your session has ended or you do not have access. Please sign in again.'
  return `Something went wrong (${status}). Please try again.`
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'),
    credentials: 'include',
    headers: opts.form ? undefined : { 'Content-Type': 'application/json' },
    body: opts.form ? opts.form : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status)
  return data as T
}

/** Upload one photo to the Media Library. */
export async function uploadMedia(file: File, alt = ''): Promise<any> {
  const form = new FormData()
  form.append('file', file)
  // every photo needs a description; start from the file name until someone writes a better one
  const fallback = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'Photo'
  form.append('_payload', JSON.stringify({ alt: alt || fallback }))
  const res = await api<{ doc: any }>('/api/media', { form })
  return res.doc
}

/** Replace the file behind a Media Library item, keeping the item (and every place it is used). */
export async function replaceMedia(id: string | number, file: File): Promise<any> {
  const form = new FormData()
  form.append('file', file)
  form.append('_payload', JSON.stringify({}))
  const res = await api<{ doc: any }>(`/api/media/${id}`, { method: 'PATCH', form })
  return res.doc
}

export function mediaSrc(doc: any, size?: 'thumb' | 'og'): string {
  if (!doc) return ''
  const raw: string = (size && doc.sizes?.[size]?.url) || doc.url || ''
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/media/')) return raw
  try {
    const u = new URL(raw, window.location.origin)
    return u.pathname.replace(/\/+$/, '') + u.search
  } catch {
    return raw
  }
}

export const MAX_UPLOAD_MB = 20
