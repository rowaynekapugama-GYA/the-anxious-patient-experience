/**
 * Sending email: the booking emails and the dashboard's password emails.
 *
 * Two providers, whichever is set up in Vercel:
 * - SMTP2GO (GYA's standard): SMTP2GO_API_KEY. Used when it is set.
 * - Resend: RESEND_API_KEY.
 * BOOKING_FROM is the sender for every email, on a domain verified with that provider, for example
 * "The Anxious Patient Experience <bookings@thecronulladentists.com.au>".
 * SMTP2GO_ENDPOINT and RESEND_API_URL point at a test server instead (for testing only).
 */

export type Email = {
  from?: string
  to: string[]
  reply_to?: string
  bcc?: string[]
  subject: string
  text: string
  html: string
}

export function emailProvider(): 'smtp2go' | 'resend' | null {
  if (process.env.SMTP2GO_API_KEY) return 'smtp2go'
  if (process.env.RESEND_API_KEY) return 'resend'
  return null
}

/** True when emails can be sent: a provider key and a sender. */
export function emailConfigured(): boolean {
  return !!emailProvider() && !!process.env.BOOKING_FROM
}

export async function sendEmail(msg: Email): Promise<void> {
  const from = msg.from || process.env.BOOKING_FROM || ''
  const provider = emailProvider()
  if (!provider || !from) throw new Error('email is not set up (SMTP2GO_API_KEY or RESEND_API_KEY, and BOOKING_FROM)')
  if (provider === 'smtp2go') {
    const r = await fetch(process.env.SMTP2GO_ENDPOINT || 'https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Smtp2go-Api-Key': String(process.env.SMTP2GO_API_KEY) },
      body: JSON.stringify({
        sender: from,
        to: msg.to,
        ...(msg.bcc?.length ? { bcc: msg.bcc } : {}),
        subject: msg.subject,
        text_body: msg.text,
        html_body: msg.html,
        ...(msg.reply_to ? { custom_headers: [{ header: 'Reply-To', value: msg.reply_to }] } : {}),
      }),
    })
    const body = await r.json().catch(() => ({})) as { data?: { succeeded?: number; failed?: number; failures?: unknown[]; error?: string } }
    // SMTP2GO can answer 200 and still report a failed recipient
    if (!r.ok || !body.data || (body.data.failed ?? 0) > 0 || !(body.data.succeeded ?? 0)) {
      throw new Error(`SMTP2GO ${r.status}: ${JSON.stringify(body).slice(0, 300)}`)
    }
    return
  }
  const r = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...msg, from }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`)
}

/** The website's own address for links in emails: NEXT_PUBLIC_SERVER_URL, else Vercel's production address. */
export function siteOrigin(fallback: string): string {
  const v = process.env.NEXT_PUBLIC_SERVER_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || fallback
  return v.replace(/\/+$/, '')
}
