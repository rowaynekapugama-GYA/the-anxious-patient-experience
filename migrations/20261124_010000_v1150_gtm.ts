import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * v1.15.0: additive only, safe to run more than once.
 *   - Site Settings > Tracking gets the Google Tag Manager ID. It starts blank, which means "use the default
 *     container in src/site.config.ts"; the build then writes that ID into the blank field (src/sitekit/releases.ts),
 *     and leaves a different ID, or "off", alone.
 * Nothing else is changed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "tracking_gtm" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "tracking_gtm";`)
}
