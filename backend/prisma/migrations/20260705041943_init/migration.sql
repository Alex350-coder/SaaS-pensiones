-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CLIENT', 'RESTAURANT_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "restaurant_status" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "dish_category" AS ENUM ('STARTER', 'MAIN', 'BEVERAGE', 'DESSERT');

-- CreateEnum
CREATE TYPE "menu_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "pension_status" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('CONFIRMED', 'CANCELLED', 'FULFILLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('WILL_ATTEND', 'WILL_NOT_ATTEND', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "notice_type" AS ENUM ('MENU_CHANGE', 'SCHEDULE_CHANGE', 'PROMOTION', 'CLOSURE', 'GENERAL');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('NOTICE', 'PENSION_EXPIRING', 'PAYMENT_DUE', 'NEW_MESSAGE', 'RESERVATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('ISSUED', 'VOIDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30),
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT NOT NULL,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "address" VARCHAR(255) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "contact_phone" VARCHAR(30) NOT NULL,
    "contact_email" CITEXT NOT NULL,
    "status" "restaurant_status" NOT NULL DEFAULT 'PENDING',
    "monthly_pension_price" DECIMAL(10,2) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "opens_at" TIME(0) NOT NULL,
    "closes_at" TIME(0) NOT NULL,

    CONSTRAINT "restaurant_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "category" "dish_category" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_menus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "menu_date" DATE NOT NULL,
    "status" "menu_status" NOT NULL DEFAULT 'DRAFT',
    "menu_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_menu_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "daily_menu_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "course" "dish_category" NOT NULL,

    CONSTRAINT "daily_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "pension_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pension_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(6),
    "registered_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "daily_menu_id" UUID NOT NULL,
    "pension_id" UUID,
    "estimated_arrival" TIME(0) NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'CONFIRMED',
    "notes" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pension_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pension_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "notice_type" NOT NULL DEFAULT 'GENERAL',
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_reads" (
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_reads_pkey" PRIMARY KEY ("notice_id","user_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "series" VARCHAR(10) NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL,
    "pdf_url" TEXT,
    "status" "invoice_status" NOT NULL DEFAULT 'ISSUED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_images_restaurant_id_sort_order_key" ON "restaurant_images"("restaurant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_schedules_restaurant_id_day_of_week_key" ON "restaurant_schedules"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE INDEX "dishes_restaurant_id_category_idx" ON "dishes"("restaurant_id", "category");

-- CreateIndex
CREATE INDEX "daily_menus_menu_date_status_idx" ON "daily_menus"("menu_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menus_restaurant_id_menu_date_key" ON "daily_menus"("restaurant_id", "menu_date");

-- CreateIndex
CREATE INDEX "daily_menu_items_dish_id_idx" ON "daily_menu_items"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menu_items_daily_menu_id_dish_id_key" ON "daily_menu_items"("daily_menu_id", "dish_id");

-- CreateIndex
CREATE INDEX "pensions_client_id_idx" ON "pensions"("client_id");

-- CreateIndex
CREATE INDEX "pensions_restaurant_id_status_idx" ON "pensions"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "pensions_status_end_date_idx" ON "pensions"("status", "end_date");

-- CreateIndex
CREATE INDEX "payments_pension_id_idx" ON "payments"("pension_id");

-- CreateIndex
CREATE INDEX "payments_registered_by_idx" ON "payments"("registered_by");

-- CreateIndex
CREATE INDEX "reservations_daily_menu_id_status_idx" ON "reservations"("daily_menu_id", "status");

-- CreateIndex
CREATE INDEX "reservations_client_id_idx" ON "reservations"("client_id");

-- CreateIndex
CREATE INDEX "reservations_pension_id_idx" ON "reservations"("pension_id");

-- CreateIndex
CREATE INDEX "attendances_restaurant_id_attendance_date_status_idx" ON "attendances"("restaurant_id", "attendance_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_pension_id_attendance_date_key" ON "attendances"("pension_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_pension_id_key" ON "conversations"("pension_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_id_idx" ON "messages"("conversation_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notices_restaurant_id_published_at_idx" ON "notices"("restaurant_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "notice_reads_user_id_idx" ON "notice_reads"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_series_restaurant_id_series_key" ON "invoice_series"("restaurant_id", "series");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_series_id_number_key" ON "invoices"("series_id", "number");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_images" ADD CONSTRAINT "restaurant_images_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_schedules" ADD CONSTRAINT "restaurant_schedules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menus" ADD CONSTRAINT "daily_menus_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_daily_menu_id_fkey" FOREIGN KEY ("daily_menu_id") REFERENCES "daily_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pensions" ADD CONSTRAINT "pensions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pensions" ADD CONSTRAINT "pensions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_pension_id_fkey" FOREIGN KEY ("pension_id") REFERENCES "pensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_daily_menu_id_fkey" FOREIGN KEY ("daily_menu_id") REFERENCES "daily_menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_pension_id_fkey" FOREIGN KEY ("pension_id") REFERENCES "pensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_pension_id_fkey" FOREIGN KEY ("pension_id") REFERENCES "pensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pension_id_fkey" FOREIGN KEY ("pension_id") REFERENCES "pensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "invoice_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written business invariants (docs/database-design.md §4).
-- Prisma cannot express partial indexes, CHECK constraints, or composite FKs;
-- its diff engine ignores them, so they are stable here. Still: review every
-- future generated migration before applying.
-- ---------------------------------------------------------------------------

-- Uniqueness scoped to live rows: soft delete frees email/slug/owner for reuse
CREATE UNIQUE INDEX "uq_users_email_live"
  ON "users" ("email") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_restaurants_slug_live"
  ON "restaurants" ("slug") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_restaurants_owner_live"
  ON "restaurants" ("owner_id") WHERE "deleted_at" IS NULL;

-- Public catalog access path (status = APPROVED, not soft-deleted)
CREATE INDEX "idx_restaurants_catalog"
  ON "restaurants" ("status") WHERE "deleted_at" IS NULL;

-- One live pension per client and restaurant
CREATE UNIQUE INDEX "uq_live_pension_per_client_restaurant"
  ON "pensions" ("client_id", "restaurant_id")
  WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE');

-- One live reservation per client and daily menu (cancelling frees the slot)
CREATE UNIQUE INDEX "uq_live_reservation_per_client_menu"
  ON "reservations" ("client_id", "daily_menu_id")
  WHERE "status" <> 'CANCELLED';

-- Fast unread-notifications counter
CREATE INDEX "idx_notifications_unread"
  ON "notifications" ("user_id")
  WHERE "read_at" IS NULL;

-- Composite FKs: cross-table consistency the app cannot silently break.
-- A reservation's pension must belong to the reservation's client, and an
-- attendance's denormalized restaurant must match its pension's restaurant.
-- (MATCH SIMPLE: rows with pension_id NULL are exempt, as intended.)
ALTER TABLE "pensions"
  ADD CONSTRAINT "uq_pensions_id_client" UNIQUE ("id", "client_id"),
  ADD CONSTRAINT "uq_pensions_id_restaurant" UNIQUE ("id", "restaurant_id");

ALTER TABLE "reservations"
  ADD CONSTRAINT "fk_reservation_pension_client"
  FOREIGN KEY ("pension_id", "client_id")
  REFERENCES "pensions" ("id", "client_id");

ALTER TABLE "attendances"
  ADD CONSTRAINT "fk_attendance_pension_restaurant"
  FOREIGN KEY ("pension_id", "restaurant_id")
  REFERENCES "pensions" ("id", "restaurant_id");

-- Data-quality CHECK constraints
ALTER TABLE "restaurant_schedules"
  ADD CONSTRAINT "chk_schedule_day_range" CHECK ("day_of_week" BETWEEN 0 AND 6),
  ADD CONSTRAINT "chk_schedule_open_before_close" CHECK ("opens_at" < "closes_at");

ALTER TABLE "dishes"
  ADD CONSTRAINT "chk_dish_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "daily_menus"
  ADD CONSTRAINT "chk_menu_price_non_negative" CHECK ("menu_price" >= 0);

-- Pensions are a fixed 30-day contract
ALTER TABLE "pensions"
  ADD CONSTRAINT "chk_pension_30_days" CHECK ("end_date" = "start_date" + 30),
  ADD CONSTRAINT "chk_pension_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payment_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "chk_payment_confirmed_has_paid_at"
    CHECK ("status" <> 'CONFIRMED' OR "paid_at" IS NOT NULL);

ALTER TABLE "messages"
  ADD CONSTRAINT "chk_message_length" CHECK (char_length("content") <= 2000);

ALTER TABLE "invoice_series"
  ADD CONSTRAINT "chk_series_next_number_positive" CHECK ("next_number" >= 1);

ALTER TABLE "invoices"
  ADD CONSTRAINT "chk_invoice_number_positive" CHECK ("number" > 0);
