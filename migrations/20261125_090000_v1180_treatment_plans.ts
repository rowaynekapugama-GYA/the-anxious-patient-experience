import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * v1.18.0: additive only, safe to run more than once.
 *   - Users gets "Can create and view treatment plans", off for everyone (GYA administrators included).
 * The treatment plan tables (ape_plans, ape_plan_forms, ape_plan_links, ape_plan_sends, ape_plan_log) are created by
 * the plan code with IF NOT EXISTS the first time it runs (src/plans/store.ts), like the booking tables. Nothing else
 * is changed, so v1.17.0 still runs on the database after a rollback.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "can_treatment_plans" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" DROP COLUMN IF EXISTS "can_treatment_plans";`)
}
