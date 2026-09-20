


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



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."favorite_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "city" "text",
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "favorite_services_country_check" CHECK (("length"(TRIM(BOTH FROM "country")) > 0)),
    CONSTRAINT "favorite_services_name_check" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "favorite_services_type_check" CHECK (("type" = ANY (ARRAY['hotel'::"text", 'airline'::"text", 'transfer'::"text", 'tour'::"text", 'insurance'::"text", 'car_rental'::"text", 'additional'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."favorite_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."favorite_services" IS 'Catálogo de serviços reutilizáveis para preenchimento de novos pacotes. Fonte de dados apenas — packages mantêm snapshot próprio.';



COMMENT ON COLUMN "public"."favorite_services"."type" IS 'Tipo do serviço: hotel, airline, transfer, tour, insurance, car_rental, additional, other';



COMMENT ON COLUMN "public"."favorite_services"."active" IS 'Serviços inativos não aparecem nas sugestões de autocomplete. Pacotes já criados não são alterados.';



CREATE TABLE IF NOT EXISTS "public"."package_website_contents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "content" "jsonb" NOT NULL,
    "markdown" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."package_website_contents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "base_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "packages_base_currency_check" CHECK (("base_currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."packages" IS 'Armazena pacotes base de viagens e seus componentes flexíveis via JSONB';



CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid",
    "reference" "text" NOT NULL,
    "client_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "exchange_rate" numeric(12,6),
    "exchange_rate_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quotations_currency_check" CHECK (("currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "quotations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotations" IS 'Armazena cotações com snapshot independente do pacote original no campo data (JSONB)';



COMMENT ON COLUMN "public"."quotations"."package_id" IS 'Referência ao pacote de origem. Mantém rastreabilidade sem afetar o snapshot independente';



COMMENT ON COLUMN "public"."quotations"."data" IS 'Snapshot completo e imutável dos dados e componentes da cotação no momento de criação';



ALTER TABLE ONLY "public"."favorite_services"
    ADD CONSTRAINT "favorite_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_website_contents"
    ADD CONSTRAINT "package_website_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_website_contents"
    ADD CONSTRAINT "uq_package_website_contents_package_id" UNIQUE ("package_id");



CREATE INDEX "idx_favorite_services_active" ON "public"."favorite_services" USING "btree" ("active");



CREATE INDEX "idx_favorite_services_created_at" ON "public"."favorite_services" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_favorite_services_name" ON "public"."favorite_services" USING "btree" ("lower"("name"));



CREATE INDEX "idx_favorite_services_type" ON "public"."favorite_services" USING "btree" ("type");



CREATE INDEX "idx_package_website_contents_package_id" ON "public"."package_website_contents" USING "btree" ("package_id");



CREATE INDEX "idx_packages_created_at" ON "public"."packages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_packages_reference" ON "public"."packages" USING "btree" ("reference");



CREATE INDEX "idx_packages_status" ON "public"."packages" USING "btree" ("status");



CREATE INDEX "idx_quotations_created_at" ON "public"."quotations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_quotations_package_id" ON "public"."quotations" USING "btree" ("package_id");



CREATE INDEX "idx_quotations_reference" ON "public"."quotations" USING "btree" ("reference");



CREATE INDEX "idx_quotations_status" ON "public"."quotations" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "tr_favorite_services_set_updated_at" BEFORE UPDATE ON "public"."favorite_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_package_website_contents_set_updated_at" BEFORE UPDATE ON "public"."package_website_contents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_packages_set_updated_at" BEFORE UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_quotations_set_updated_at" BEFORE UPDATE ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."package_website_contents"
    ADD CONSTRAINT "package_website_contents_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



CREATE POLICY "Allow anon and authenticated all on favorite_services" ON "public"."favorite_services" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on package_website_contents" ON "public"."package_website_contents" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on packages" ON "public"."packages" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on quotations" ON "public"."quotations" TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."favorite_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_website_contents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."favorite_services" TO "anon";
GRANT ALL ON TABLE "public"."favorite_services" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_services" TO "service_role";



GRANT ALL ON TABLE "public"."package_website_contents" TO "anon";
GRANT ALL ON TABLE "public"."package_website_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."package_website_contents" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";









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



































