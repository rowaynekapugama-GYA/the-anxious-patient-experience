/**
 * POST /api/questionnaire/save  {token, answers}   (v1.9.0)
 * "Save and finish later": the answers so far, encrypted like submitted ones, kept on the booking's questionnaire
 * row for the same private link. Nothing is sent to the team. Rate limited. Answers are never logged.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { saveDraft, tooMany } from '@/lib/questionnaire'
import { readBody, send } from '@/booking/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
  if (tooMany(`save:${ip}`, 40, 10 * 60 * 1000)) return send(429, { ok: false, state: 'busy' })
  let body: Record<string, unknown>
  try { body = await readBody(req) } catch { return send(400, { ok: false, state: 'invalid' }) }
  const token = String(body.token || '')
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return send(404, { ok: false, state: 'invalid' })
  if (tooMany(`save-token:${token.slice(0, 12)}`, 30, 10 * 60 * 1000)) return send(429, { ok: false, state: 'busy' })
  const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {}
  try {
    const payload = await getPayload({ config })
    const r = await saveDraft(payload, token, answers)
    if (r.ok) return send(200, { ok: true, savedAt: r.savedAt })
    if (r.state === 'no_key') return send(503, { ok: false, state: 'no_key' })
    return send(404, { ok: false, state: r.state })
  } catch (err) {
    console.error('questionnaire: save failed', (err as Error).message)
    return send(500, { ok: false, state: 'error' })
  }
}
