/**
 * POST /api/questionnaire/submit  {token, answers, consent}
 * The patient's answers from a private link. Cleaned against Lorna's form, encrypted and saved; the team is told by
 * email (reference and appointment date only). Rate limited per address and per token. Answers are never logged.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { submitAnswers, tooMany } from '@/lib/questionnaire'
import { readBody, send } from '@/booking/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
  if (tooMany(`submit:${ip}`, 20, 10 * 60 * 1000)) return send(429, { ok: false, state: 'busy' })
  let body: Record<string, unknown>
  try { body = await readBody(req) } catch { return send(400, { ok: false, state: 'invalid' }) }
  const token = String(body.token || '')
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return send(404, { ok: false, state: 'invalid' })
  if (tooMany(`token:${token.slice(0, 12)}`, 8, 10 * 60 * 1000)) return send(429, { ok: false, state: 'busy' })
  const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {}
  try {
    const payload = await getPayload({ config })
    const r = await submitAnswers(payload, token, answers, body.consent === true)
    if (r.ok) return send(200, { ok: true })
    if (r.state === 'invalid_answers' || r.state === 'consent') return send(400, r)
    if (r.state === 'no_key') return send(503, { ok: false, state: 'no_key' })
    return send(404, { ok: false, state: r.state })
  } catch (err) {
    // never log answers: only that it failed
    console.error('questionnaire: submit failed', (err as Error).message)
    return send(500, { ok: false, state: 'error' })
  }
}
