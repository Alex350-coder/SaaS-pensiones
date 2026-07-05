-- Least-privilege runtime role for the API (Phase 2 deliverable).
--
-- Apply with:   pnpm db:grants        (prisma db execute, runs as the
--                                      migration owner from DATABASE_URL)
-- Re-run after EVERY migration so grants cover newly created tables.
--
-- The dev password below is local-only (same trust level as the postgres
-- password in docker-compose.yml). Production credentials come from a
-- secret manager and are rotated — Phase 18.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pensiones_app') THEN
    CREATE ROLE pensiones_app LOGIN PASSWORD 'pensiones_app_dev';
  END IF;
END
$$;

-- No DDL: the role can use the schema but never create in it.
REVOKE CREATE ON SCHEMA public FROM pensiones_app;
GRANT CONNECT ON DATABASE pensiones TO pensiones_app;
GRANT USAGE ON SCHEMA public TO pensiones_app;

-- Full DML on business tables; sequences covered for completeness.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pensiones_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pensiones_app;

-- Audit trail is append-only from the app's perspective.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM pensiones_app;

-- Migration bookkeeping belongs exclusively to the migration owner.
REVOKE ALL ON TABLE _prisma_migrations FROM pensiones_app;
