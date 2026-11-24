import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * v1.16.0: additive only, safe to run more than once.
 *   - Site Settings gets the Google Business Profile link, written into the structured data as sameAs. It starts
 *     blank, which leaves the structured data as it was.
 * The team's notes and the Onboarding call tick live in the booking tables (ape_booking_notes, and two new columns on
 * ape_bookings), which the booking code creates with IF NOT EXISTS the first time it runs (src/booking/core.ts).
 * Nothing else is changed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "google_profile_link" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "google_profile_link";`)
}
