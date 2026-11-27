import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * v1.19.0: a new login can create and view treatment plans from the start (Lorna, 27 Nov 2026: "All users can create
 * and view plans"). Only the column default changes; existing logins are given it once by the release step
 * v1.19.0-plan-permission-all (src/sitekit/releases.ts). v1.18.1 still runs on the database after a rollback.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "can_treatment_plans" SET DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "can_treatment_plans" SET DEFAULT false;`)
}
