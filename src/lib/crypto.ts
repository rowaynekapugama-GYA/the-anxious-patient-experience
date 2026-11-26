/**
 * Field encryption for patient questionnaire answers (AES-256-GCM), on top of the database's own encryption.
 * The key is QUESTIONNAIRE_ENCRYPTION_KEY: 32 random bytes, base64 (openssl rand -base64 32). It never changes once
 * answers exist, because they could not be read back. Keep a copy somewhere safe outside Vercel.
 */
import crypto from 'node:crypto'

export type Sealed = { v: 1; iv: string; tag: string; data: string }

export function encryptionKey(): Buffer | null {
  const raw = process.env.QUESTIONNAIRE_ENCRYPTION_KEY || ''
  if (!raw) return null
  const key = Buffer.from(raw.trim(), 'base64')
  return key.length === 32 ? key : null
}

export const encryptionReady = () => !!encryptionKey()

/**
 * v1.18.0: treatment plans have their own key, TREATMENT_PLAN_ENCRYPTION_KEY (the same format), so a plan can never
 * be read with the questionnaire key or the other way round. The same rule: it never changes once plans exist.
 */
export function planKey(): Buffer | null {
  const raw = process.env.TREATMENT_PLAN_ENCRYPTION_KEY || ''
  if (!raw) return null
  const key = Buffer.from(raw.trim(), 'base64')
  return key.length === 32 ? key : null
}
export const planKeyReady = () => !!planKey()

export function seal(plain: string, key = encryptionKey()): Sealed {
  if (!key) throw new Error('the encryption key is missing or not 32 bytes of base64')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

export function unseal(sealed: Sealed, key = encryptionKey()): string {
  if (!key) throw new Error('the encryption key is missing or not 32 bytes of base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8')
}

/** A private-link token (URL safe) and the hash the database keeps instead of it. */
export const newToken = () => crypto.randomBytes(32).toString('base64url')
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
