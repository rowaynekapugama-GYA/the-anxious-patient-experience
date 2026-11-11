import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_questionnaires_status" AS ENUM('sent', 'submitted', 'expired');
  CREATE TYPE "public"."enum_questionnaire_log_action" AS ENUM('viewed', 'printed', 'reviewed', 'unreviewed', 'deleted', 'denied', 'resent');
  CREATE TYPE "public"."enum_site_settings_questionnaire_send_when" AS ENUM('confirmed', 'requested');
  CREATE TYPE "public"."enum_questionnaire_sections_questions_type" AS ENUM('text', 'textarea', 'yesno', 'choice', 'multi', 'scale', 'date', 'dob', 'signature', 'note');
  CREATE TABLE "questionnaires" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_ref" varchar NOT NULL,
  	"patient_name" varchar,
  	"appointment_at" timestamp(3) with time zone,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"status" "enum_questionnaires_status" DEFAULT 'sent' NOT NULL,
  	"sent_at" timestamp(3) with time zone,
  	"sent_count" numeric DEFAULT 1,
  	"submitted_at" timestamp(3) with time zone,
  	"sealed" varchar,
  	"reviewed" boolean DEFAULT false,
  	"reviewed_by" varchar,
  	"reviewed_at" timestamp(3) with time zone,
  	"retain_until" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "questionnaire_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"user_id" varchar,
  	"user_email" varchar NOT NULL,
  	"action" "enum_questionnaire_log_action" NOT NULL,
  	"booking_ref" varchar,
  	"questionnaire" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_questionnaire_notify_emails" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"address" varchar NOT NULL
  );
  
  CREATE TABLE "questionnaire_sections_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"type" "enum_questionnaire_sections_questions_type" DEFAULT 'text' NOT NULL,
  	"options" varchar,
  	"help" varchar,
  	"required" boolean DEFAULT false
  );
  
  CREATE TABLE "questionnaire_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "questionnaire" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'New Patient Questionnaire',
  	"intro" varchar,
  	"collection_notice" varchar,
  	"consent_label" varchar,
  	"thank_you" varchar,
  	"welcome_pack_id" integer,
  	"welcome_subject" varchar,
  	"welcome_body" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "can_view_questionnaires" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "questionnaires_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "questionnaire_log_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "google_review_link" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "questionnaire_send_when" "enum_site_settings_questionnaire_send_when" DEFAULT 'confirmed';
  ALTER TABLE "site_settings_questionnaire_notify_emails" ADD CONSTRAINT "site_settings_questionnaire_notify_emails_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "questionnaire_sections_questions" ADD CONSTRAINT "questionnaire_sections_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."questionnaire_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "questionnaire_sections" ADD CONSTRAINT "questionnaire_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."questionnaire"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_welcome_pack_id_media_id_fk" FOREIGN KEY ("welcome_pack_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "questionnaires_booking_ref_idx" ON "questionnaires" USING btree ("booking_ref");
  CREATE UNIQUE INDEX "questionnaires_token_hash_idx" ON "questionnaires" USING btree ("token_hash");
  CREATE INDEX "questionnaires_updated_at_idx" ON "questionnaires" USING btree ("updated_at");
  CREATE INDEX "questionnaires_created_at_idx" ON "questionnaires" USING btree ("created_at");
  CREATE INDEX "questionnaire_log_at_idx" ON "questionnaire_log" USING btree ("at");
  CREATE INDEX "questionnaire_log_booking_ref_idx" ON "questionnaire_log" USING btree ("booking_ref");
  CREATE INDEX "questionnaire_log_updated_at_idx" ON "questionnaire_log" USING btree ("updated_at");
  CREATE INDEX "questionnaire_log_created_at_idx" ON "questionnaire_log" USING btree ("created_at");
  CREATE INDEX "site_settings_questionnaire_notify_emails_order_idx" ON "site_settings_questionnaire_notify_emails" USING btree ("_order");
  CREATE INDEX "site_settings_questionnaire_notify_emails_parent_id_idx" ON "site_settings_questionnaire_notify_emails" USING btree ("_parent_id");
  CREATE INDEX "questionnaire_sections_questions_order_idx" ON "questionnaire_sections_questions" USING btree ("_order");
  CREATE INDEX "questionnaire_sections_questions_parent_id_idx" ON "questionnaire_sections_questions" USING btree ("_parent_id");
  CREATE INDEX "questionnaire_sections_order_idx" ON "questionnaire_sections" USING btree ("_order");
  CREATE INDEX "questionnaire_sections_parent_id_idx" ON "questionnaire_sections" USING btree ("_parent_id");
  CREATE INDEX "questionnaire_welcome_pack_idx" ON "questionnaire" USING btree ("welcome_pack_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_questionnaires_fk" FOREIGN KEY ("questionnaires_id") REFERENCES "public"."questionnaires"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_questionnaire_log_fk" FOREIGN KEY ("questionnaire_log_id") REFERENCES "public"."questionnaire_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_questionnaires_id_idx" ON "payload_locked_documents_rels" USING btree ("questionnaires_id");
  CREATE INDEX "payload_locked_documents_rels_questionnaire_log_id_idx" ON "payload_locked_documents_rels" USING btree ("questionnaire_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "questionnaires" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questionnaire_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_questionnaire_notify_emails" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questionnaire_sections_questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questionnaire_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questionnaire" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "questionnaires" CASCADE;
  DROP TABLE "questionnaire_log" CASCADE;
  DROP TABLE "site_settings_questionnaire_notify_emails" CASCADE;
  DROP TABLE "questionnaire_sections_questions" CASCADE;
  DROP TABLE "questionnaire_sections" CASCADE;
  DROP TABLE "questionnaire" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_questionnaires_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_questionnaire_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_questionnaires_id_idx";
  DROP INDEX "payload_locked_documents_rels_questionnaire_log_id_idx";
  ALTER TABLE "users" DROP COLUMN "can_view_questionnaires";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "questionnaires_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "questionnaire_log_id";
  ALTER TABLE "site_settings" DROP COLUMN "google_review_link";
  ALTER TABLE "site_settings" DROP COLUMN "questionnaire_send_when";
  DROP TYPE "public"."enum_questionnaires_status";
  DROP TYPE "public"."enum_questionnaire_log_action";
  DROP TYPE "public"."enum_site_settings_questionnaire_send_when";
  DROP TYPE "public"."enum_questionnaire_sections_questions_type";`)
}
