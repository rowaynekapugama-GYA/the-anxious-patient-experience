import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * v1.9.0: additive only. Questionnaires get the form version, answers saved to finish later and test rows; Site
 * Settings gets the two welcome pack PDFs and the switches (both off). Safe to run more than once.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "questionnaires" ADD COLUMN IF NOT EXISTS "form" varchar;
  ALTER TABLE "questionnaires" ADD COLUMN IF NOT EXISTS "draft" varchar;
  ALTER TABLE "questionnaires" ADD COLUMN IF NOT EXISTS "draft_saved_at" timestamp(3) with time zone;
  ALTER TABLE "questionnaires" ADD COLUMN IF NOT EXISTS "test" boolean DEFAULT false;
  ALTER TABLE "questionnaires" ADD COLUMN IF NOT EXISTS "test_email" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_guide_pdf_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_questionnaire_pdf_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_welcome_email_on" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_online_on" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_notice_approved" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_notice_approved_by" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "questionnaire_notice_approved_at" timestamp(3) with time zone;
  DO $$ BEGIN
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_questionnaire_guide_pdf_id_media_id_fk" FOREIGN KEY ("questionnaire_guide_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_questionnaire_questionnaire_pdf_id_media_id_fk" FOREIGN KEY ("questionnaire_questionnaire_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "questionnaires_test_idx" ON "questionnaires" USING btree ("test");
  CREATE INDEX IF NOT EXISTS "site_settings_questionnaire_questionnaire_guide_pdf_idx" ON "site_settings" USING btree ("questionnaire_guide_pdf_id");
  CREATE INDEX IF NOT EXISTS "site_settings_questionnaire_questionnaire_questionnaire__idx" ON "site_settings" USING btree ("questionnaire_questionnaire_pdf_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_questionnaire_guide_pdf_id_media_id_fk";
  ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_questionnaire_questionnaire_pdf_id_media_id_fk";
  DROP INDEX IF EXISTS "questionnaires_test_idx";
  DROP INDEX IF EXISTS "site_settings_questionnaire_questionnaire_guide_pdf_idx";
  DROP INDEX IF EXISTS "site_settings_questionnaire_questionnaire_questionnaire__idx";
  ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "form";
  ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "draft";
  ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "draft_saved_at";
  ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "test";
  ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "test_email";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_guide_pdf_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_questionnaire_pdf_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_welcome_email_on";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_online_on";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_notice_approved";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_notice_approved_by";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "questionnaire_notice_approved_at";`)
}
