/**
 * Who gets each email (v1.8.3), read live from the dashboard so a change in Site Settings applies to the next
 * booking straight away (no Publish needed).
 *
 * Team emails (new booking, deposit received, questionnaire received): Site Settings > Who receives booking emails,
 * else BOOKING_NOTIFY_EMAIL, else BOOKING_NOTIFY_TO, else the APE inbox written into the code, so a booking can
 * never go to nobody.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { DEFAULT_NOTIFY_TO } from '@/booking/core'
import { GYA_FALLBACK } from '@/lib/mailer'
import { DEFAULTS } from '@/site.config'

export type Source = 'Site Settings' | 'BOOKING_NOTIFY_EMAIL' | 'BOOKING_NOTIFY_TO' | 'built-in fallback'
export type Resolved = { list: string[]; source: Source }

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
const split = (v: string | undefined) => String(v || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => EMAIL.test(x))

export function resolveTeam(fromSettings: string[]): Resolved {
  const s = fromSettings.filter((x) => EMAIL.test(x))
  if (s.length) return { list: [...new Set(s)], source: 'Site Settings' }
  const a = split(process.env.BOOKING_NOTIFY_EMAIL)
  if (a.length) return { list: a, source: 'BOOKING_NOTIFY_EMAIL' }
  const b = split(process.env.BOOKING_NOTIFY_TO)
  if (b.length) return { list: b, source: 'BOOKING_NOTIFY_TO' }
  return { list: [DEFAULT_NOTIFY_TO], source: 'built-in fallback' }
}

export type Live = {
  team: Resolved
  /** the APE inbox: Reply-To on every email to a patient */
  apeInbox: string
  gya: { on: boolean; to: string; source: 'Site Settings' | 'built-in fallback' }
  /** v1.7.0 questionnaire notify list, if set (else the team list) */
  questionnaire: string[]
  bcc: string[]
}

export async function liveRecipients(): Promise<Live> {
  let s: Record<string, any> | null = null
  try {
    const payload = await getPayload({ config })
    s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>
  } catch (err) {
    console.error('recipients: could not read Site Settings, using the fallbacks', (err as Error).message)
  }
  const addrs = (v: unknown) => ((v as { address?: string }[] | undefined) ?? []).map((r) => String(r?.address || '').trim()).filter(Boolean)
  const gyaTo = String(s?.gyaNoticeTo || '').trim()
  return {
    team: resolveTeam(addrs(s?.bookingRecipients)),
    apeInbox: String(s?.apeEmail || '').trim() || DEFAULTS.apeEmail || DEFAULT_NOTIFY_TO,
    gya: { on: s?.gyaDeliveryNotice !== false, to: EMAIL.test(gyaTo) ? gyaTo : GYA_FALLBACK, source: EMAIL.test(gyaTo) ? 'Site Settings' : 'built-in fallback' },
    questionnaire: addrs(s?.questionnaire?.notifyEmails).filter((x) => EMAIL.test(x)),
    bcc: split(process.env.BOOKING_BCC),
  }
}
