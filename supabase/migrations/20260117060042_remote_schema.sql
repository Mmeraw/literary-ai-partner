


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."mood_context" AS ENUM (
    'calm',
    'tense',
    'dread',
    'frenetic',
    'melancholic',
    'absurd'
);


ALTER TYPE "public"."mood_context" OWNER TO "postgres";


CREATE TYPE "public"."register_lock" AS ENUM (
    'none',
    'soft',
    'hard'
);


ALTER TYPE "public"."register_lock" OWNER TO "postgres";


CREATE TYPE "public"."tone_context" AS ENUM (
    'neutral',
    'dark',
    'comic',
    'clinical',
    'lyrical',
    'gritty',
    'transgressive'
);


ALTER TYPE "public"."tone_context" OWNER TO "postgres";


CREATE TYPE "public"."voice_mode" AS ENUM (
    'preserve_strict',
    'balanced',
    'agent_line_editor'
);


ALTER TYPE "public"."voice_mode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."access_log" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "action" "text",
    "resource" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."access_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."access_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."access_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."access_log_id_seq" OWNED BY "public"."access_log"."id";



CREATE TABLE IF NOT EXISTS "public"."analytics" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "event_type" "text",
    "event_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."analytics_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_id_seq" OWNED BY "public"."analytics"."id";



CREATE TABLE IF NOT EXISTS "public"."evaluation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "manuscript_id" bigint NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "progress" "jsonb" DEFAULT '{}'::"jsonb",
    "total_units" integer DEFAULT 0,
    "completed_units" integer DEFAULT 0,
    "failed_units" integer DEFAULT 0,
    "retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_heartbeat" timestamp with time zone,
    "phase" "text" NOT NULL,
    "work_type" "text",
    "policy_family" "text" NOT NULL,
    "voice_preservation_level" "text" NOT NULL,
    "english_variant" "text" NOT NULL,
    CONSTRAINT "chk_eval_jobs_english_variant" CHECK (("english_variant" = ANY (ARRAY['us'::"text", 'uk'::"text", 'ca'::"text", 'au'::"text"]))),
    CONSTRAINT "chk_eval_jobs_policy_family" CHECK (("policy_family" = ANY (ARRAY['standard'::"text", 'dark_fiction'::"text", 'trauma_memoir'::"text"]))),
    CONSTRAINT "chk_eval_jobs_voice_preservation_level" CHECK (("voice_preservation_level" = ANY (ARRAY['strict'::"text", 'balanced'::"text", 'expressive'::"text"]))),
    CONSTRAINT "evaluation_jobs_job_type_check" CHECK (("job_type" = ANY (ARRAY['full_evaluation'::"text", 'quick_evaluation'::"text", 'screenplay_evaluation'::"text", 'wave_only'::"text", 'summary_only'::"text", 're_evaluate_chunk'::"text", 're_evaluate_wave'::"text", 'novel_to_screenplay'::"text", 'synopsis_generation'::"text", 'query_package_generation'::"text", 'comparables_generation'::"text", 'governance_validation'::"text", 'backfill_migration'::"text"]))),
    CONSTRAINT "evaluation_jobs_phase_check" CHECK (("phase" = ANY (ARRAY['phase_0'::"text", 'phase_1'::"text", 'phase_2'::"text"]))),
    CONSTRAINT "evaluation_jobs_phase_chk" CHECK (("phase" = ANY (ARRAY['phase_0'::"text", 'phase_1'::"text", 'phase_2'::"text"])))
);


ALTER TABLE "public"."evaluation_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluations" (
    "id" bigint NOT NULL,
    "manuscript_id" bigint,
    "user_id" "uuid" NOT NULL,
    "evaluation_data" "jsonb",
    "score" numeric(5,2),
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."evaluations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."evaluations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evaluations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evaluations_id_seq" OWNED BY "public"."evaluations"."id";



CREATE TABLE IF NOT EXISTS "public"."manuscripts" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "title" "text" NOT NULL,
    "file_url" "text",
    "file_size" bigint,
    "work_type" "text",
    "status" "text" DEFAULT 'uploaded'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tone_context" "public"."tone_context" DEFAULT 'neutral'::"public"."tone_context" NOT NULL,
    "mood_context" "public"."mood_context" DEFAULT 'calm'::"public"."mood_context" NOT NULL,
    "voice_mode" "public"."voice_mode" DEFAULT 'balanced'::"public"."voice_mode" NOT NULL,
    "default_register_lock" "public"."register_lock" GENERATED ALWAYS AS (
CASE "voice_mode"
    WHEN 'preserve_strict'::"public"."voice_mode" THEN 'hard'::"public"."register_lock"
    WHEN 'balanced'::"public"."voice_mode" THEN 'soft'::"public"."register_lock"
    WHEN 'agent_line_editor'::"public"."voice_mode" THEN 'none'::"public"."register_lock"
    ELSE NULL::"public"."register_lock"
END) STORED,
    "created_by" "uuid",
    "storygate_linked" boolean DEFAULT false NOT NULL,
    "allow_industry_discovery" boolean DEFAULT false NOT NULL,
    "is_final" boolean DEFAULT false NOT NULL,
    "source" "text" DEFAULT 'dashboard'::"text" NOT NULL,
    "english_variant" "text" DEFAULT 'us'::"text" NOT NULL,
    "word_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "manuscripts_english_variant_check" CHECK (("english_variant" = ANY (ARRAY['us'::"text", 'uk'::"text", 'ca'::"text", 'au'::"text"]))),
    CONSTRAINT "manuscripts_source_check" CHECK (("source" = ANY (ARRAY['dashboard'::"text", 'paste'::"text", 'upload'::"text"])))
);


ALTER TABLE "public"."manuscripts" OWNER TO "postgres";


COMMENT ON TABLE "public"."manuscripts" IS 'Stores uploaded manuscripts for evaluation';



ALTER TABLE "public"."manuscripts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."manuscripts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."story_criteria" (
    "id" bigint NOT NULL,
    "criterion_name" "text" NOT NULL,
    "description" "text",
    "weight" numeric(3,2),
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."story_criteria" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."story_criteria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."story_criteria_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."story_criteria_id_seq" OWNED BY "public"."story_criteria"."id";



ALTER TABLE ONLY "public"."access_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."access_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."evaluations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."evaluations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."story_criteria" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."story_criteria_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."access_log"
    ADD CONSTRAINT "access_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics"
    ADD CONSTRAINT "analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_jobs"
    ADD CONSTRAINT "evaluation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manuscripts"
    ADD CONSTRAINT "manuscripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_criteria"
    ADD CONSTRAINT "story_criteria_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_evaluation_jobs_manuscript_id" ON "public"."evaluation_jobs" USING "btree" ("manuscript_id");



CREATE INDEX "idx_evaluation_jobs_status_next_retry" ON "public"."evaluation_jobs" USING "btree" ("status", "next_retry_at");



CREATE INDEX "idx_evaluations_manuscript_id" ON "public"."evaluations" USING "btree" ("manuscript_id");



CREATE UNIQUE INDEX "uq_eval_jobs_active_phase1" ON "public"."evaluation_jobs" USING "btree" ("manuscript_id", "job_type") WHERE (("phase" = 'phase_1'::"text") AND ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"])));



CREATE UNIQUE INDEX "uq_eval_jobs_active_phase1_kind" ON "public"."evaluation_jobs" USING "btree" ("manuscript_id", "job_type", "policy_family", COALESCE("work_type", ''::"text")) WHERE (("phase" = 'phase_1'::"text") AND ("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'retry_pending'::"text"])));



CREATE UNIQUE INDEX "uq_eval_jobs_active_phase1_worktype" ON "public"."evaluation_jobs" USING "btree" ("manuscript_id", "job_type", "work_type") WHERE (("phase" = 'phase_1'::"text") AND ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"])));



CREATE OR REPLACE TRIGGER "trg_evaluation_jobs_updated_at" BEFORE UPDATE ON "public"."evaluation_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."evaluation_jobs"
    ADD CONSTRAINT "evaluation_jobs_manuscript_id_fkey" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_manuscript_id_fkey" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE CASCADE;



CREATE POLICY "Admin/Enterprise: view aggregate analytics" ON "public"."analytics" FOR SELECT USING (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = ANY (ARRAY['admin_reviewer'::"text", 'enterprise_manager'::"text"])));



CREATE POLICY "Admin: view Storygate manuscripts" ON "public"."manuscripts" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'admin_reviewer'::"text") AND ("storygate_linked" = true)));



CREATE POLICY "Admin: view all access logs" ON "public"."access_log" FOR SELECT USING (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'admin_reviewer'::"text"));



CREATE POLICY "Admin: view evaluations for Storygate manuscripts" ON "public"."evaluations" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'admin_reviewer'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."manuscripts" "m"
  WHERE (("m"."id" = "evaluations"."manuscript_id") AND ("m"."storygate_linked" = true))))));



CREATE POLICY "Authenticated users can read story criteria" ON "public"."story_criteria" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Author: insert own manuscripts" ON "public"."manuscripts" FOR INSERT WITH CHECK ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Author: update own manuscripts" ON "public"."manuscripts" FOR UPDATE USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND ("created_by" = "auth"."uid"()))) WITH CHECK ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Author: view evaluations for own manuscripts" ON "public"."evaluations" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."manuscripts" "m"
  WHERE (("m"."id" = "evaluations"."manuscript_id") AND ("m"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Author: view own access logs" ON "public"."access_log" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Author: view own analytics" ON "public"."analytics" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Author: view own manuscripts" ON "public"."manuscripts" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'author'::"text") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Industry: view curated evaluation summaries" ON "public"."evaluations" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'industry_agent'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."manuscripts" "m"
  WHERE (("m"."id" = "evaluations"."manuscript_id") AND ("m"."storygate_linked" = true) AND ("m"."allow_industry_discovery" = true) AND ("m"."is_final" = true))))));



CREATE POLICY "Industry: view opted-in manuscripts" ON "public"."manuscripts" FOR SELECT USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'industry_agent'::"text") AND ("storygate_linked" = true) AND ("allow_industry_discovery" = true) AND ("is_final" = true)));



CREATE POLICY "Users can insert own manuscripts" ON "public"."manuscripts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own manuscripts" ON "public"."manuscripts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own access logs" ON "public"."access_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own evaluations" ON "public"."evaluations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own manuscripts" ON "public"."manuscripts" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."access_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluation_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluation_jobs_insert_own" ON "public"."evaluation_jobs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."manuscripts" "m"
  WHERE (("m"."id" = "evaluation_jobs"."manuscript_id") AND ("m"."created_by" = "auth"."uid"())))));



CREATE POLICY "evaluation_jobs_select_own" ON "public"."evaluation_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."manuscripts" "m"
  WHERE (("m"."id" = "evaluation_jobs"."manuscript_id") AND ("m"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manuscripts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_criteria" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."access_log" TO "anon";
GRANT ALL ON TABLE "public"."access_log" TO "authenticated";
GRANT ALL ON TABLE "public"."access_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."access_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."access_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."access_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."analytics" TO "anon";
GRANT ALL ON TABLE "public"."analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."analytics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_jobs" TO "anon";
GRANT ALL ON TABLE "public"."evaluation_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."evaluations" TO "anon";
GRANT ALL ON TABLE "public"."evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."manuscripts" TO "anon";
GRANT ALL ON TABLE "public"."manuscripts" TO "authenticated";
GRANT ALL ON TABLE "public"."manuscripts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."manuscripts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."manuscripts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manuscripts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."story_criteria" TO "anon";
GRANT ALL ON TABLE "public"."story_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."story_criteria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."story_criteria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."story_criteria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."story_criteria_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


