


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."erp_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."erp_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  last_num int;
  new_num int;
  year text := to_char(now(), 'YYYY');
begin
  select coalesce(max(split_part(order_number, '-', 3)::int), 0)
  into last_num
  from orders
  where split_part(order_number, '-', 2) = year;

  new_num := last_num + 1;

  return 'DYN-' || year || '-' || lpad(new_num::text, 4, '0');
end;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_counter"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  new_value integer;
begin
  update counter
  set value = value + 1
  where id = 1
  returning value into new_value;

  return new_value;
end;
$$;


ALTER FUNCTION "public"."increment_counter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_counter"("counter_key" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  new_value integer;
begin
  update counter
  set value = value + 1
  where key = counter_key
  returning value into new_value;

  return new_value;
end;
$$;


ALTER FUNCTION "public"."increment_counter"("counter_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_monthly_counter"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_value INTEGER;
  current_month_key TEXT;
  today_month_key TEXT := TO_CHAR(NOW(), 'YYYYMM');
BEGIN
  -- Row lock; prevents race conditions
  SELECT value, month_key INTO current_value, current_month_key
  FROM counter
  WHERE id = 1
  FOR UPDATE;

  IF current_month_key IS NULL OR current_month_key <> today_month_key THEN
    current_value := 1;
    UPDATE counter
    SET value = current_value,
        month_key = today_month_key,
        updated_at = NOW()
    WHERE id = 1;
  ELSE
    current_value := current_value + 1;
    UPDATE counter
    SET value = current_value,
        updated_at = NOW()
    WHERE id = 1;
  END IF;

  RETURN current_value;
END;
$$;


ALTER FUNCTION "public"."increment_monthly_counter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_email_allowed"("check_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE email = check_email
  );
END;
$$;


ALTER FUNCTION "public"."is_email_allowed"("check_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_erp_number"("p_sequence_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_prefix text;
  v_value integer;
  v_result text;
begin
  update public.erp_number_sequences
  set current_value = current_value + 1,
      year = extract(year from now())::integer,
      updated_at = now()
  where sequence_key = p_sequence_key
  returning prefix, current_value into v_prefix, v_value;

  if v_prefix is null then
    raise exception 'Sequence key not found: %', p_sequence_key;
  end if;

  v_result := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_value::text, 5, '0');
  return v_result;
end;
$$;


ALTER FUNCTION "public"."next_erp_number"("p_sequence_key" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allowed_emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."allowed_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."counter" (
    "id" bigint NOT NULL,
    "value" bigint DEFAULT 0 NOT NULL,
    "month_key" "text",
    "updated_at" timestamp without time zone
);


ALTER TABLE "public"."counter" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "firma" "text" NOT NULL,
    "ilgili_kisi" "text",
    "telefon" "text",
    "email" "text",
    "konu" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers_full" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "address" "text",
    "short_name" "text",
    "phone" "text"
);


ALTER TABLE "public"."customers_full" OWNER TO "postgres";


ALTER TABLE "public"."customers_full" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."customers_full_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text",
    "version_no" integer DEFAULT 1 NOT NULL,
    "uploaded_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "asset_name" "text" NOT NULL,
    "asset_code" "text",
    "assigned_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "returned_date" "date",
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "work_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "regular_hours" numeric(5,2) DEFAULT 0 NOT NULL,
    "overtime_hours" numeric(5,2) DEFAULT 0 NOT NULL,
    "work_order_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text",
    "department" "text",
    "phone" "text",
    "email" "text",
    "hire_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_email" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action" "text" NOT NULL,
    "old_status" "text",
    "new_status" "text",
    "description" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."erp_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_number_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sequence_key" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "year" integer,
    "month" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."erp_number_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_quotation_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid",
    "stakeholder_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "valid_until" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "erp_quotation_links_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'approved'::"text", 'rejected'::"text", 'converted_to_order'::"text"])))
);


ALTER TABLE "public"."erp_quotation_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "department" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."erp_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "opening_balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "current_balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_accounts_account_type_check" CHECK (("account_type" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'customer'::"text", 'supplier'::"text"])))
);


ALTER TABLE "public"."financial_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_type" "text" NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "unit" "text" DEFAULT 'adet'::"text" NOT NULL,
    "current_stock" numeric(14,3) DEFAULT 0 NOT NULL,
    "min_stock" numeric(14,3) DEFAULT 0 NOT NULL,
    "location" "text",
    "supplier_id" "uuid",
    "unit_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['raw_material'::"text", 'consumable'::"text", 'tool'::"text", 'measuring_tool'::"text", 'finished_good'::"text", 'semi_finished'::"text"])))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inventory_item_id" "uuid",
    "movement_type" "text" NOT NULL,
    "quantity" numeric(14,3) NOT NULL,
    "source_type" "text",
    "source_id" "uuid",
    "movement_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['in'::"text", 'out'::"text", 'adjustment'::"text", 'reservation'::"text", 'return'::"text"])))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_type" "text" NOT NULL,
    "invoice_no" "text",
    "stakeholder_id" "uuid",
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "tax_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_invoice_type_check" CHECK (("invoice_type" = ANY (ARRAY['sales'::"text", 'purchase'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'paid'::"text", 'partial'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "machine_type" "text",
    "location" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "maintenance_interval_days" integer,
    "last_maintenance_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."machines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "machine_id" "uuid",
    "task_name" "text" NOT NULL,
    "task_type" "text" DEFAULT 'periodic'::"text" NOT NULL,
    "planned_date" "date",
    "completed_date" "date",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "responsible_employee_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "maintenance_tasks_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "maintenance_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['periodic'::"text", 'breakdown'::"text", 'inspection'::"text"])))
);


ALTER TABLE "public"."maintenance_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measuring_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "serial_no" "text",
    "calibration_due_date" "date",
    "last_calibration_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "assigned_to" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "measuring_tools_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'calibration_due'::"text", 'in_calibration'::"text", 'out_of_service'::"text"])))
);


ALTER TABLE "public"."measuring_tools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_counter" (
    "id" integer DEFAULT 1 NOT NULL,
    "year" integer NOT NULL,
    "counter" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."order_counter" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(12,2) NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "company_name" "text",
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "notes" "text",
    "subtotal" numeric(12,2) NOT NULL,
    "tax_total" numeric(12,2) NOT NULL,
    "grand_total" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'bank_transfer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parasut_contacts" (
    "parasut_id" "text" NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "tax_number" "text",
    "updated_at" timestamp without time zone,
    "raw_json" "jsonb"
);


ALTER TABLE "public"."parasut_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parasut_invoices" (
    "parasut_id" "text" NOT NULL,
    "invoice_no" "text",
    "issue_date" "date",
    "net_total" numeric,
    "gross_total" numeric,
    "currency" "text",
    "customer_id" "text",
    "updated_at" timestamp without time zone,
    "raw_json" "jsonb"
);


ALTER TABLE "public"."parasut_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parasut_products" (
    "parasut_id" "text" NOT NULL,
    "name" "text",
    "code" "text",
    "unit" "text",
    "unit_price" numeric,
    "currency" "text",
    "updated_at" timestamp without time zone,
    "raw_json" "jsonb"
);


ALTER TABLE "public"."parasut_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parasut_tokens" (
    "id" bigint NOT NULL,
    "company_id" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text" NOT NULL,
    "expires_at" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parasut_tokens" OWNER TO "postgres";


ALTER TABLE "public"."parasut_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."parasut_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_type" "text" NOT NULL,
    "stakeholder_id" "uuid",
    "financial_account_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text",
    "related_invoice_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['collection'::"text", 'payment'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "image_url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false
);


ALTER TABLE "public"."product_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_route_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_id" "uuid",
    "step_no" integer NOT NULL,
    "operation_name" "text" NOT NULL,
    "machine_id" "uuid",
    "estimated_minutes" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."production_route_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_template" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."production_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "sku" "text",
    "price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "in_stock" boolean DEFAULT true NOT NULL,
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "category" "text",
    "brand" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid",
    "inventory_item_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(14,3) DEFAULT 1,
    "unit" "text" DEFAULT 'adet'::"text",
    "unit_price" numeric(14,2) DEFAULT 0,
    "total" numeric(14,2) DEFAULT 0,
    "received_quantity" numeric(14,3) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_no" "text" NOT NULL,
    "supplier_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE,
    "expected_delivery_date" "date",
    "currency" "text" DEFAULT 'TRY'::"text",
    "subtotal" numeric(14,2) DEFAULT 0,
    "tax_total" numeric(14,2) DEFAULT 0,
    "grand_total" numeric(14,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "purchase_orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'partially_received'::"text", 'received'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quality_report_id" "uuid",
    "characteristic" "text" NOT NULL,
    "nominal_value" "text",
    "tolerance" "text",
    "measured_value" "text",
    "result" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quality_measurements_result_check" CHECK (("result" = ANY (ARRAY['pending'::"text", 'passed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."quality_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_no" "text" NOT NULL,
    "work_order_id" "uuid",
    "sales_order_id" "uuid",
    "inspector_employee_id" "uuid",
    "inspection_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "result" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quality_reports_result_check" CHECK (("result" = ANY (ARRAY['pending'::"text", 'passed'::"text", 'failed'::"text", 'conditional'::"text"])))
);


ALTER TABLE "public"."quality_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teklif_no" "text" NOT NULL,
    "firma" "text" NOT NULL,
    "ilgili_kisi" "text" NOT NULL,
    "tel" "text",
    "email" "text",
    "konu" "text",
    "products" "jsonb" NOT NULL,
    "active_currency" "text" DEFAULT 'TRY'::"text",
    "notlar" "text",
    "opsiyon" "text",
    "teslim_suresi" "text",
    "odeme_sekli" "text",
    "teslim_yeri" "text",
    "subtotal" numeric DEFAULT 0,
    "kdv" numeric DEFAULT 0,
    "total" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotations" IS 'Teklif PDF kayıt tablosu';



CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_order_id" "uuid",
    "item_code" "text",
    "description" "text" NOT NULL,
    "quantity" numeric(14,3) DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'adet'::"text" NOT NULL,
    "unit_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "total" numeric(14,2) DEFAULT 0 NOT NULL,
    "technical_drawing_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_no" "text" NOT NULL,
    "stakeholder_id" "uuid",
    "source_quotation_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "tax_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_orders_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "sales_orders_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'confirmed'::"text", 'in_production'::"text", 'waiting_subcontractor'::"text", 'ready_to_ship'::"text", 'shipped'::"text", 'invoiced'::"text", 'closed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" integer NOT NULL,
    "auth_enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(14,3) DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'adet'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shipment_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_no" "text" NOT NULL,
    "sales_order_id" "uuid",
    "stakeholder_id" "uuid",
    "carrier" "text",
    "tracking_no" "text",
    "delivery_note_no" "text",
    "package_count" integer DEFAULT 1 NOT NULL,
    "shipment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shipments_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'packed'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smoke_test" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."smoke_test" OWNER TO "postgres";


ALTER TABLE "public"."smoke_test" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."smoke_test_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stakeholders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text",
    "phone" "text",
    "email" "text",
    "tax_office" "text",
    "tax_number" "text",
    "address" "text",
    "city" "text",
    "country" "text" DEFAULT 'Türkiye'::"text" NOT NULL,
    "risk_limit" numeric(14,2) DEFAULT 0 NOT NULL,
    "current_balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stakeholders_type_check" CHECK (("type" = ANY (ARRAY['customer'::"text", 'supplier'::"text", 'subcontractor'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."stakeholders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subcontracting_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid",
    "supplier_id" "uuid",
    "process_type" "text" NOT NULL,
    "dispatch_no" "text",
    "sent_date" "date",
    "expected_return_date" "date",
    "returned_date" "date",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "quantity_sent" numeric(14,3) DEFAULT 0 NOT NULL,
    "quantity_returned" numeric(14,3) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subcontracting_jobs_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'sent'::"text", 'in_process'::"text", 'returned'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."subcontracting_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid",
    "step_no" integer NOT NULL,
    "operation_name" "text" NOT NULL,
    "machine_id" "uuid",
    "assigned_employee_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "planned_minutes" integer DEFAULT 0 NOT NULL,
    "actual_minutes" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "quality_required" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_order_operations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'paused'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."work_order_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_no" "text" NOT NULL,
    "sales_order_id" "uuid",
    "stakeholder_id" "uuid",
    "title" "text" NOT NULL,
    "part_name" "text",
    "part_code" "text",
    "quantity" numeric(14,3) DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "planned_start_date" "date",
    "planned_end_date" "date",
    "actual_start_at" timestamp with time zone,
    "actual_end_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_orders_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "work_orders_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'released'::"text", 'in_progress'::"text", 'paused'::"text", 'waiting_subcontractor'::"text", 'quality_check'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allowed_emails"
    ADD CONSTRAINT "allowed_emails_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."allowed_emails"
    ADD CONSTRAINT "allowed_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."counter"
    ADD CONSTRAINT "counter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_profile"
    ADD CONSTRAINT "customer_profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers_full"
    ADD CONSTRAINT "customers_full_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_assets"
    ADD CONSTRAINT "employee_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_audit_logs"
    ADD CONSTRAINT "erp_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_number_sequences"
    ADD CONSTRAINT "erp_number_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_number_sequences"
    ADD CONSTRAINT "erp_number_sequences_sequence_key_key" UNIQUE ("sequence_key");



ALTER TABLE ONLY "public"."erp_quotation_links"
    ADD CONSTRAINT "erp_quotation_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_users"
    ADD CONSTRAINT "erp_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."erp_users"
    ADD CONSTRAINT "erp_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_accounts"
    ADD CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machines"
    ADD CONSTRAINT "machines_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."machines"
    ADD CONSTRAINT "machines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measuring_tools"
    ADD CONSTRAINT "measuring_tools_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."measuring_tools"
    ADD CONSTRAINT "measuring_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_counter"
    ADD CONSTRAINT "order_counter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parasut_contacts"
    ADD CONSTRAINT "parasut_contacts_pkey" PRIMARY KEY ("parasut_id");



ALTER TABLE ONLY "public"."parasut_invoices"
    ADD CONSTRAINT "parasut_invoices_pkey" PRIMARY KEY ("parasut_id");



ALTER TABLE ONLY "public"."parasut_products"
    ADD CONSTRAINT "parasut_products_pkey" PRIMARY KEY ("parasut_id");



ALTER TABLE ONLY "public"."parasut_tokens"
    ADD CONSTRAINT "parasut_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_route_steps"
    ADD CONSTRAINT "production_route_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_route_steps"
    ADD CONSTRAINT "production_route_steps_unique_step" UNIQUE ("route_id", "step_no");



ALTER TABLE ONLY "public"."production_routes"
    ADD CONSTRAINT "production_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_purchase_order_no_key" UNIQUE ("purchase_order_no");



ALTER TABLE ONLY "public"."quality_measurements"
    ADD CONSTRAINT "quality_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_reports"
    ADD CONSTRAINT "quality_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_reports"
    ADD CONSTRAINT "quality_reports_report_no_key" UNIQUE ("report_no");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_teklif_no_key" UNIQUE ("teklif_no");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_order_no_key" UNIQUE ("order_no");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipment_items"
    ADD CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_shipment_no_key" UNIQUE ("shipment_no");



ALTER TABLE ONLY "public"."smoke_test"
    ADD CONSTRAINT "smoke_test_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stakeholders"
    ADD CONSTRAINT "stakeholders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcontracting_jobs"
    ADD CONSTRAINT "subcontracting_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_operations"
    ADD CONSTRAINT "work_order_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_operations"
    ADD CONSTRAINT "work_order_operations_unique_step" UNIQUE ("work_order_id", "step_no");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_work_order_no_key" UNIQUE ("work_order_no");



CREATE INDEX "idx_documents_entity" ON "public"."documents" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_employee_time_entries_employee_date" ON "public"."employee_time_entries" USING "btree" ("employee_id", "work_date");



CREATE INDEX "idx_employees_active" ON "public"."employees" USING "btree" ("is_active");



CREATE INDEX "idx_erp_audit_logs_created_at" ON "public"."erp_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_erp_audit_logs_entity" ON "public"."erp_audit_logs" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_erp_quotation_links_quotation_id" ON "public"."erp_quotation_links" USING "btree" ("quotation_id");



CREATE INDEX "idx_inventory_items_stock_levels" ON "public"."inventory_items" USING "btree" ("current_stock", "min_stock");



CREATE INDEX "idx_inventory_items_type" ON "public"."inventory_items" USING "btree" ("item_type");



CREATE INDEX "idx_inventory_movements_item_date" ON "public"."inventory_movements" USING "btree" ("inventory_item_id", "movement_date" DESC);



CREATE INDEX "idx_maintenance_tasks_planned_date" ON "public"."maintenance_tasks" USING "btree" ("planned_date");



CREATE INDEX "idx_maintenance_tasks_status" ON "public"."maintenance_tasks" USING "btree" ("status");



CREATE INDEX "idx_purchase_order_items_order" ON "public"."purchase_order_items" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_purchase_orders_status" ON "public"."purchase_orders" USING "btree" ("status");



CREATE INDEX "idx_purchase_orders_supplier" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_quality_measurements_report_id" ON "public"."quality_measurements" USING "btree" ("quality_report_id");



CREATE INDEX "idx_quality_reports_inspection_date" ON "public"."quality_reports" USING "btree" ("inspection_date");



CREATE INDEX "idx_quality_reports_result" ON "public"."quality_reports" USING "btree" ("result");



CREATE INDEX "idx_quality_reports_work_order_id" ON "public"."quality_reports" USING "btree" ("work_order_id");



CREATE INDEX "idx_sales_order_items_sales_order_id" ON "public"."sales_order_items" USING "btree" ("sales_order_id");



CREATE INDEX "idx_sales_orders_due_date" ON "public"."sales_orders" USING "btree" ("due_date");



CREATE INDEX "idx_sales_orders_source_quotation_id" ON "public"."sales_orders" USING "btree" ("source_quotation_id");



CREATE INDEX "idx_sales_orders_stakeholder" ON "public"."sales_orders" USING "btree" ("stakeholder_id");



CREATE INDEX "idx_sales_orders_status" ON "public"."sales_orders" USING "btree" ("status");



CREATE INDEX "idx_shipment_items_shipment_id" ON "public"."shipment_items" USING "btree" ("shipment_id");



CREATE INDEX "idx_shipments_sales_order_id" ON "public"."shipments" USING "btree" ("sales_order_id");



CREATE INDEX "idx_shipments_shipment_date" ON "public"."shipments" USING "btree" ("shipment_date");



CREATE INDEX "idx_shipments_status" ON "public"."shipments" USING "btree" ("status");



CREATE INDEX "idx_stakeholders_company_name" ON "public"."stakeholders" USING "btree" ("company_name");



CREATE INDEX "idx_stakeholders_type_active" ON "public"."stakeholders" USING "btree" ("type", "is_active");



CREATE INDEX "idx_subcontracting_jobs_expected_return" ON "public"."subcontracting_jobs" USING "btree" ("expected_return_date");



CREATE INDEX "idx_subcontracting_jobs_status" ON "public"."subcontracting_jobs" USING "btree" ("status");



CREATE INDEX "idx_subcontracting_jobs_work_order_id" ON "public"."subcontracting_jobs" USING "btree" ("work_order_id");



CREATE INDEX "idx_work_order_operations_machine_id" ON "public"."work_order_operations" USING "btree" ("machine_id");



CREATE INDEX "idx_work_order_operations_work_order_id" ON "public"."work_order_operations" USING "btree" ("work_order_id");



CREATE INDEX "idx_work_orders_planned_end" ON "public"."work_orders" USING "btree" ("planned_end_date");



CREATE INDEX "idx_work_orders_sales_order_id" ON "public"."work_orders" USING "btree" ("sales_order_id");



CREATE INDEX "idx_work_orders_stakeholder" ON "public"."work_orders" USING "btree" ("stakeholder_id");



CREATE INDEX "idx_work_orders_status" ON "public"."work_orders" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "trg_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_erp_users_updated_at" BEFORE UPDATE ON "public"."erp_users" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventory_items_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_machines_updated_at" BEFORE UPDATE ON "public"."machines" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_maintenance_tasks_updated_at" BEFORE UPDATE ON "public"."maintenance_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_measuring_tools_updated_at" BEFORE UPDATE ON "public"."measuring_tools" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_quality_reports_updated_at" BEFORE UPDATE ON "public"."quality_reports" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sales_orders_updated_at" BEFORE UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shipments_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_stakeholders_updated_at" BEFORE UPDATE ON "public"."stakeholders" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subcontracting_jobs_updated_at" BEFORE UPDATE ON "public"."subcontracting_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_work_orders_updated_at" BEFORE UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."erp_set_updated_at"();



ALTER TABLE ONLY "public"."employee_assets"
    ADD CONSTRAINT "employee_assets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");



ALTER TABLE ONLY "public"."erp_quotation_links"
    ADD CONSTRAINT "erp_quotation_links_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id");



ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_route_steps"
    ADD CONSTRAINT "production_route_steps_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id");



ALTER TABLE ONLY "public"."production_route_steps"
    ADD CONSTRAINT "production_route_steps_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."production_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."quality_measurements"
    ADD CONSTRAINT "quality_measurements_quality_report_id_fkey" FOREIGN KEY ("quality_report_id") REFERENCES "public"."quality_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_reports"
    ADD CONSTRAINT "quality_reports_inspector_employee_id_fkey" FOREIGN KEY ("inspector_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."quality_reports"
    ADD CONSTRAINT "quality_reports_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."quality_reports"
    ADD CONSTRAINT "quality_reports_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."shipment_items"
    ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."subcontracting_jobs"
    ADD CONSTRAINT "subcontracting_jobs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."stakeholders"("id");



ALTER TABLE ONLY "public"."subcontracting_jobs"
    ADD CONSTRAINT "subcontracting_jobs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");



ALTER TABLE ONLY "public"."work_order_operations"
    ADD CONSTRAINT "work_order_operations_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id");



ALTER TABLE ONLY "public"."work_order_operations"
    ADD CONSTRAINT "work_order_operations_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id");



CREATE POLICY "Admin delete customer_profile" ON "public"."customer_profile" FOR DELETE TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Admin read customer_profile" ON "public"."customer_profile" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Admin update customer_profile" ON "public"."customer_profile" FOR UPDATE TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails"))) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Allow admin write product_images" ON "public"."product_images" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails"))) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Allow admin write products" ON "public"."products" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails"))) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Allow admin_users read for authenticated" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users" ON "public"."allowed_emails" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."quotations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow logged in users to check whitelist" ON "public"."allowed_emails" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public read product_images" ON "public"."product_images" FOR SELECT USING (true);



CREATE POLICY "Allow public read products" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Allow read auth settings" ON "public"."settings" FOR SELECT TO "authenticated", "anon" USING (("id" = 1));



CREATE POLICY "Allow read customer_profile" ON "public"."customer_profile" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow read for allowed users" ON "public"."counter" FOR SELECT TO "authenticated" USING ("public"."is_email_allowed"(("auth"."jwt"() ->> 'email'::"text")));



CREATE POLICY "Allow read for allowed users only" ON "public"."customers_full" FOR SELECT TO "authenticated" USING ("public"."is_email_allowed"(("auth"."jwt"() ->> 'email'::"text")));



CREATE POLICY "Allow read for authenticated users" ON "public"."quotations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read quotations" ON "public"."quotations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow select for authenticated allowed emails" ON "public"."order_items" FOR SELECT USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Allow select for authenticated allowed emails" ON "public"."orders" FOR SELECT USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "allowed_emails"."email"
   FROM "public"."allowed_emails")));



CREATE POLICY "Allow update for allowed users" ON "public"."counter" FOR UPDATE TO "authenticated" USING ("public"."is_email_allowed"(("auth"."jwt"() ->> 'email'::"text"))) WITH CHECK ("public"."is_email_allowed"(("auth"."jwt"() ->> 'email'::"text")));



CREATE POLICY "Anyone can read order_counter" ON "public"."order_counter" FOR SELECT USING (true);



CREATE POLICY "Anyone can read settings" ON "public"."settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can update order_counter" ON "public"."order_counter" FOR UPDATE USING (true);



CREATE POLICY "Authenticated insert customer_profile" ON "public"."customer_profile" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read allowed_emails" ON "public"."allowed_emails" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allowed_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."counter" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers_full" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_insert_authenticated" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "documents_select_authenticated" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "documents_update_authenticated" ON "public"."documents" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."employee_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_assets_insert_authenticated" ON "public"."employee_assets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "employee_assets_select_authenticated" ON "public"."employee_assets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "employee_assets_update_authenticated" ON "public"."employee_assets" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."employee_time_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_time_entries_insert_authenticated" ON "public"."employee_time_entries" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "employee_time_entries_select_authenticated" ON "public"."employee_time_entries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "employee_time_entries_update_authenticated" ON "public"."employee_time_entries" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_insert_authenticated" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "employees_select_authenticated" ON "public"."employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "employees_update_authenticated" ON "public"."employees" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert employee_assets" ON "public"."employee_assets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert employee_time_entries" ON "public"."employee_time_entries" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert employees" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert erp_audit_logs" ON "public"."erp_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert erp_number_sequences" ON "public"."erp_number_sequences" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert erp_quotation_links" ON "public"."erp_quotation_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert erp_users" ON "public"."erp_users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert financial_accounts" ON "public"."financial_accounts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert inventory_items" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert inventory_movements" ON "public"."inventory_movements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert machines" ON "public"."machines" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert maintenance_tasks" ON "public"."maintenance_tasks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert measuring_tools" ON "public"."measuring_tools" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert payments" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert production_route_steps" ON "public"."production_route_steps" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert production_routes" ON "public"."production_routes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert purchase_order_items" ON "public"."purchase_order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert purchase_orders" ON "public"."purchase_orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert quality_measurements" ON "public"."quality_measurements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert quality_reports" ON "public"."quality_reports" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert sales_order_items" ON "public"."sales_order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert sales_orders" ON "public"."sales_orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert shipment_items" ON "public"."shipment_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert shipments" ON "public"."shipments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert stakeholders" ON "public"."stakeholders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert subcontracting_jobs" ON "public"."subcontracting_jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert work_order_operations" ON "public"."work_order_operations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated insert work_orders" ON "public"."work_orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp authenticated select documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select employee_assets" ON "public"."employee_assets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select employee_time_entries" ON "public"."employee_time_entries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select employees" ON "public"."employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select erp_audit_logs" ON "public"."erp_audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select erp_number_sequences" ON "public"."erp_number_sequences" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select erp_quotation_links" ON "public"."erp_quotation_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select erp_users" ON "public"."erp_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select financial_accounts" ON "public"."financial_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select inventory_items" ON "public"."inventory_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select inventory_movements" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select machines" ON "public"."machines" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select maintenance_tasks" ON "public"."maintenance_tasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select measuring_tools" ON "public"."measuring_tools" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select production_route_steps" ON "public"."production_route_steps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select production_routes" ON "public"."production_routes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select purchase_order_items" ON "public"."purchase_order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select purchase_orders" ON "public"."purchase_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select quality_measurements" ON "public"."quality_measurements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select quality_reports" ON "public"."quality_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select sales_order_items" ON "public"."sales_order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select sales_orders" ON "public"."sales_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select shipment_items" ON "public"."shipment_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select shipments" ON "public"."shipments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select stakeholders" ON "public"."stakeholders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select subcontracting_jobs" ON "public"."subcontracting_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select work_order_operations" ON "public"."work_order_operations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated select work_orders" ON "public"."work_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp authenticated update documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update employee_assets" ON "public"."employee_assets" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update employee_time_entries" ON "public"."employee_time_entries" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update employees" ON "public"."employees" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update erp_number_sequences" ON "public"."erp_number_sequences" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update erp_quotation_links" ON "public"."erp_quotation_links" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update erp_users" ON "public"."erp_users" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update financial_accounts" ON "public"."financial_accounts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update inventory_items" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update inventory_movements" ON "public"."inventory_movements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update machines" ON "public"."machines" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update maintenance_tasks" ON "public"."maintenance_tasks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update measuring_tools" ON "public"."measuring_tools" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update payments" ON "public"."payments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update production_route_steps" ON "public"."production_route_steps" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update production_routes" ON "public"."production_routes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update purchase_order_items" ON "public"."purchase_order_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update purchase_orders" ON "public"."purchase_orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update quality_measurements" ON "public"."quality_measurements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update quality_reports" ON "public"."quality_reports" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update sales_order_items" ON "public"."sales_order_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update sales_orders" ON "public"."sales_orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update shipment_items" ON "public"."shipment_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update shipments" ON "public"."shipments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update stakeholders" ON "public"."stakeholders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update subcontracting_jobs" ON "public"."subcontracting_jobs" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update work_order_operations" ON "public"."work_order_operations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "erp authenticated update work_orders" ON "public"."work_orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."erp_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."erp_number_sequences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "erp_number_sequences_insert_authenticated" ON "public"."erp_number_sequences" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp_number_sequences_select_authenticated" ON "public"."erp_number_sequences" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp_number_sequences_update_authenticated" ON "public"."erp_number_sequences" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."erp_quotation_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "erp_quotation_links_insert_authenticated" ON "public"."erp_quotation_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp_quotation_links_select_authenticated" ON "public"."erp_quotation_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp_quotation_links_update_authenticated" ON "public"."erp_quotation_links" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."erp_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "erp_users_insert_authenticated" ON "public"."erp_users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "erp_users_select_authenticated" ON "public"."erp_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "erp_users_update_authenticated" ON "public"."erp_users" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."financial_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_accounts_insert_authenticated" ON "public"."financial_accounts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "financial_accounts_select_authenticated" ON "public"."financial_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "financial_accounts_update_authenticated" ON "public"."financial_accounts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_insert_authenticated" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "inventory_items_select_authenticated" ON "public"."inventory_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_items_update_authenticated" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_movements_insert_authenticated" ON "public"."inventory_movements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "inventory_movements_select_authenticated" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_movements_update_authenticated" ON "public"."inventory_movements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_insert_authenticated" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "invoices_select_authenticated" ON "public"."invoices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "invoices_update_authenticated" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."machines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "machines_insert_authenticated" ON "public"."machines" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "machines_select_authenticated" ON "public"."machines" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "machines_update_authenticated" ON "public"."machines" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."maintenance_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "maintenance_tasks_insert_authenticated" ON "public"."maintenance_tasks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "maintenance_tasks_select_authenticated" ON "public"."maintenance_tasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "maintenance_tasks_update_authenticated" ON "public"."maintenance_tasks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."measuring_tools" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "measuring_tools_insert_authenticated" ON "public"."measuring_tools" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "measuring_tools_select_authenticated" ON "public"."measuring_tools" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "measuring_tools_update_authenticated" ON "public"."measuring_tools" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."order_counter" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parasut_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parasut_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parasut_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parasut_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert_authenticated" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "payments_select_authenticated" ON "public"."payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "payments_update_authenticated" ON "public"."payments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."product_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_route_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "production_route_steps_insert_authenticated" ON "public"."production_route_steps" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "production_route_steps_select_authenticated" ON "public"."production_route_steps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "production_route_steps_update_authenticated" ON "public"."production_route_steps" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."production_routes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "production_routes_insert_authenticated" ON "public"."production_routes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "production_routes_select_authenticated" ON "public"."production_routes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "production_routes_update_authenticated" ON "public"."production_routes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_measurements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quality_measurements_insert_authenticated" ON "public"."quality_measurements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "quality_measurements_select_authenticated" ON "public"."quality_measurements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "quality_measurements_update_authenticated" ON "public"."quality_measurements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."quality_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quality_reports_insert_authenticated" ON "public"."quality_reports" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "quality_reports_select_authenticated" ON "public"."quality_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "quality_reports_update_authenticated" ON "public"."quality_reports" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_order_items_insert_authenticated" ON "public"."sales_order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "sales_order_items_select_authenticated" ON "public"."sales_order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sales_order_items_update_authenticated" ON "public"."sales_order_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_orders_insert_authenticated" ON "public"."sales_orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "sales_orders_select_authenticated" ON "public"."sales_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sales_orders_update_authenticated" ON "public"."sales_orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipment_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shipment_items_insert_authenticated" ON "public"."shipment_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "shipment_items_select_authenticated" ON "public"."shipment_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shipment_items_update_authenticated" ON "public"."shipment_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shipments_insert_authenticated" ON "public"."shipments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "shipments_select_authenticated" ON "public"."shipments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shipments_update_authenticated" ON "public"."shipments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."smoke_test" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stakeholders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stakeholders_insert_authenticated" ON "public"."stakeholders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "stakeholders_select_authenticated" ON "public"."stakeholders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "stakeholders_update_authenticated" ON "public"."stakeholders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."subcontracting_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subcontracting_jobs_insert_authenticated" ON "public"."subcontracting_jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "subcontracting_jobs_select_authenticated" ON "public"."subcontracting_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "subcontracting_jobs_update_authenticated" ON "public"."subcontracting_jobs" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."work_order_operations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_order_operations_insert_authenticated" ON "public"."work_order_operations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "work_order_operations_select_authenticated" ON "public"."work_order_operations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "work_order_operations_update_authenticated" ON "public"."work_order_operations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_orders_insert_authenticated" ON "public"."work_orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "work_orders_select_authenticated" ON "public"."work_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "work_orders_update_authenticated" ON "public"."work_orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."erp_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."erp_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."erp_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_counter"("counter_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_counter"("counter_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_counter"("counter_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_monthly_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_monthly_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_monthly_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_email_allowed"("check_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_email_allowed"("check_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_email_allowed"("check_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_erp_number"("p_sequence_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."next_erp_number"("p_sequence_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_erp_number"("p_sequence_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."allowed_emails" TO "anon";
GRANT ALL ON TABLE "public"."allowed_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."allowed_emails" TO "service_role";



GRANT ALL ON TABLE "public"."counter" TO "anon";
GRANT ALL ON TABLE "public"."counter" TO "authenticated";
GRANT ALL ON TABLE "public"."counter" TO "service_role";



GRANT ALL ON TABLE "public"."customer_profile" TO "anon";
GRANT ALL ON TABLE "public"."customer_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_profile" TO "service_role";



GRANT ALL ON TABLE "public"."customers_full" TO "anon";
GRANT ALL ON TABLE "public"."customers_full" TO "authenticated";
GRANT ALL ON TABLE "public"."customers_full" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_full_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_full_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_full_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."employee_assets" TO "anon";
GRANT ALL ON TABLE "public"."employee_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_assets" TO "service_role";



GRANT ALL ON TABLE "public"."employee_time_entries" TO "anon";
GRANT ALL ON TABLE "public"."employee_time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."erp_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."erp_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."erp_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."erp_number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."erp_number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."erp_number_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."erp_quotation_links" TO "anon";
GRANT ALL ON TABLE "public"."erp_quotation_links" TO "authenticated";
GRANT ALL ON TABLE "public"."erp_quotation_links" TO "service_role";



GRANT ALL ON TABLE "public"."erp_users" TO "anon";
GRANT ALL ON TABLE "public"."erp_users" TO "authenticated";
GRANT ALL ON TABLE "public"."erp_users" TO "service_role";



GRANT ALL ON TABLE "public"."financial_accounts" TO "anon";
GRANT ALL ON TABLE "public"."financial_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."machines" TO "anon";
GRANT ALL ON TABLE "public"."machines" TO "authenticated";
GRANT ALL ON TABLE "public"."machines" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_tasks" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."measuring_tools" TO "anon";
GRANT ALL ON TABLE "public"."measuring_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."measuring_tools" TO "service_role";



GRANT ALL ON TABLE "public"."order_counter" TO "anon";
GRANT ALL ON TABLE "public"."order_counter" TO "authenticated";
GRANT ALL ON TABLE "public"."order_counter" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."parasut_contacts" TO "anon";
GRANT ALL ON TABLE "public"."parasut_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."parasut_invoices" TO "anon";
GRANT ALL ON TABLE "public"."parasut_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."parasut_products" TO "anon";
GRANT ALL ON TABLE "public"."parasut_products" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_products" TO "service_role";



GRANT ALL ON TABLE "public"."parasut_tokens" TO "anon";
GRANT ALL ON TABLE "public"."parasut_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_tokens" TO "service_role";



GRANT ALL ON SEQUENCE "public"."parasut_tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."parasut_tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."parasut_tokens_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."product_images" TO "anon";
GRANT ALL ON TABLE "public"."product_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_images" TO "service_role";



GRANT ALL ON TABLE "public"."production_route_steps" TO "anon";
GRANT ALL ON TABLE "public"."production_route_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."production_route_steps" TO "service_role";



GRANT ALL ON TABLE "public"."production_routes" TO "anon";
GRANT ALL ON TABLE "public"."production_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."production_routes" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."quality_measurements" TO "anon";
GRANT ALL ON TABLE "public"."quality_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."quality_reports" TO "anon";
GRANT ALL ON TABLE "public"."quality_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_reports" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."shipment_items" TO "anon";
GRANT ALL ON TABLE "public"."shipment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shipment_items" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "anon";
GRANT ALL ON TABLE "public"."shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipments" TO "service_role";



GRANT ALL ON TABLE "public"."smoke_test" TO "anon";
GRANT ALL ON TABLE "public"."smoke_test" TO "authenticated";
GRANT ALL ON TABLE "public"."smoke_test" TO "service_role";



GRANT ALL ON SEQUENCE "public"."smoke_test_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."smoke_test_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."smoke_test_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stakeholders" TO "anon";
GRANT ALL ON TABLE "public"."stakeholders" TO "authenticated";
GRANT ALL ON TABLE "public"."stakeholders" TO "service_role";



GRANT ALL ON TABLE "public"."subcontracting_jobs" TO "anon";
GRANT ALL ON TABLE "public"."subcontracting_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."subcontracting_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_operations" TO "anon";
GRANT ALL ON TABLE "public"."work_order_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_operations" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT ALL ON TABLE "public"."work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."work_orders" TO "service_role";



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







