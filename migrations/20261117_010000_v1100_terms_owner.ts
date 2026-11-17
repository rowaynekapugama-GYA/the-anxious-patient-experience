import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * v1.10.0: additive only, safe to run more than once.
 *   - Users get "Practice owner" (off for everyone).
 *   - Site Settings get the booking terms (blank, so the drafted default is used until someone saves them).
 *   - Questionnaires get a flag for "Name or DOB differs from the booking" (off).
 *   - ape_access_log records who changed questionnaire access or practice owner, for whom and when.
 *   - Lorna's login (lorna-gladwin1@hotmail.co.uk), if it exists and is not already one, becomes the practice owner,
 *     and that is written to the access log. Nothing else is changed.
 */
export const LORNA = 'lorna-gladwin1@hotmail.co.uk'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "practice_owner" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_text" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_consent_label" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_read_label" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_version" numeric;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_changed_at" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_changed_by" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_approved_by" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_terms_approved_at" timestamp(3) with time zone;
  ALTER TABLE "questionnaires" ADD COLUMN IF NOT EXISTS "identity_differs" boolean DEFAULT false;
  CREATE TABLE IF NOT EXISTS ape_access_log (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    by_email text NOT NULL,
    for_email text NOT NULL,
    change text NOT NULL,
    note text NOT NULL DEFAULT '');
  CREATE INDEX IF NOT EXISTS ape_access_log_at ON ape_access_log (at DESC);`)

  // Lorna becomes the practice owner, only if her login exists and it is still at the old value (off)
  const set = await db.execute(sql`
    UPDATE "users" SET "practice_owner" = true
     WHERE lower("email") = ${LORNA} AND coalesce("practice_owner", false) = false
     RETURNING "email"`)
  const rows = (set as unknown as { rows?: unknown[] }).rows ?? []
  if (rows.length) {
    await db.execute(sql`INSERT INTO ape_access_log (by_email, for_email, change, note) VALUES ('v1.10.0 release', ${LORNA}, 'practice owner: on', 'Set by the v1.10.0 migration')`)
    payload.logger.info(`v1.10.0: ${LORNA} is now the practice owner (logged in ape_access_log)`)
  } else {
    const exists = await db.execute(sql`SELECT 1 FROM "users" WHERE lower("email") = ${LORNA}`)
    const found = ((exists as unknown as { rows?: unknown[] }).rows ?? []).length > 0
    payload.logger.info(found ? `v1.10.0: ${LORNA} was already the practice owner, nothing changed` : `v1.10.0: no login for ${LORNA}, so no practice owner was set. GYA can tick Practice owner on the Users screen once it exists.`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" DROP COLUMN IF EXISTS "practice_owner";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_text";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_consent_label";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_read_label";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_version";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_changed_at";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_changed_by";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_approved_by";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "booking_terms_approved_at";
  ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "identity_differs";`)
}
