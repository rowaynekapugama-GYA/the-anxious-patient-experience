/**
 * The questionnaire's questions, notices and emails (the `questionnaire` global), edited from the dashboard.
 * Editors and administrators. GET returns it as the public form will use it; POST saves the whole thing.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import { loadTemplate, PLACEHOLDER, PLACEHOLDER_PACK } from '@/lib/questionnaire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES = new Set(['text', 'textarea', 'yesno', 'choice', 'multi', 'scale', 'date', 'dob', 'signature', 'note'])
const s = (v: unknown, max = 2000) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max).trim()

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  const g = await payload.findGlobal({ slug: 'questionnaire', depth: 1, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  const t = await loadTemplate(payload)
  return json(200, {
    ok: true,
    placeholder: t.placeholder,
    saved: {
      title: g?.title || '', intro: g?.intro || '', collectionNotice: g?.collectionNotice || '', consentLabel: g?.consentLabel || '', thankYou: g?.thankYou || '',
      welcomeSubject: g?.welcomeSubject || '', welcomeBody: g?.welcomeBody || '',
      sections: (g?.sections || []).map((sec: any) => ({ heading: sec.heading || '', description: sec.description || '', questions: (sec.questions || []).map((qq: any) => ({ label: qq.label || '', type: qq.type || 'text', options: qq.options || '', help: qq.help || '', required: !!qq.required })) })),
      welcomePack: g?.welcomePack && typeof g.welcomePack === 'object' ? { id: g.welcomePack.id, filename: g.welcomePack.filename, url: g.welcomePack.url } : null,
    },
    defaults: { ...PLACEHOLDER, sections: PLACEHOLDER.sections.map((sec) => ({ heading: sec.heading, description: sec.description, questions: sec.questions.map((qq) => ({ label: qq.label, type: qq.type, options: qq.options.join('\n'), help: qq.help, required: qq.required })) })), pack: PLACEHOLDER_PACK },
  })
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  let b: Record<string, any>
  try { b = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }
  const sections = Array.isArray(b.sections) ? b.sections.slice(0, 30).map((sec: any) => ({
    heading: s(sec?.heading, 200), description: s(sec?.description, 1000),
    questions: (Array.isArray(sec?.questions) ? sec.questions : []).slice(0, 60).map((qq: any) => ({
      label: s(qq?.label, 400), type: TYPES.has(String(qq?.type)) ? String(qq.type) : 'text', options: s(qq?.options, 2000), help: s(qq?.help, 300), required: !!qq?.required,
    })).filter((qq: { label: string }) => qq.label),
  })).filter((sec: { heading: string }) => sec.heading) : []
  const data: Record<string, unknown> = {
    title: s(b.title, 120), intro: s(b.intro, 2000), collectionNotice: s(b.collectionNotice, 3000), consentLabel: s(b.consentLabel, 400), thankYou: s(b.thankYou, 2000),
    welcomeSubject: s(b.welcomeSubject, 200), welcomeBody: s(b.welcomeBody, 5000), sections,
  }
  if (b.welcomePack === null) data.welcomePack = null
  else if (b.welcomePack && (typeof b.welcomePack === 'string' || typeof b.welcomePack === 'number')) data.welcomePack = b.welcomePack
  try {
    await payload.updateGlobal({ slug: 'questionnaire', data, overrideAccess: true })
    return json(200, { ok: true })
  } catch (err) {
    console.error('questionnaire content: save failed', (err as Error).message)
    return json(500, { ok: false, error: 'server_error' })
  }
}
