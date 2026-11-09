// Synthetic historical app schema, used only by opt-in isolated Docker tests.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { targetQuery } from './recovery-restore.mjs';

const migration = name => fs.readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
export function installMigrationFixture(target, ownerType = 'uuid') {
  assert.ok(['uuid', 'text'].includes(ownerType));
  targetQuery(target, `DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
  ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
  ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
  const base = migration('000_create_base_tables.sql');
  const anchor = 'author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE';
  assert.ok(base.includes(anchor));
  targetQuery(target, ownerType === 'text' ? base.replace(anchor, 'author_id TEXT NOT NULL') : base);
  for (const file of ['003_add_oauth_fields.sql', '009_create_auth_nonces_table.sql', '001_create_weekly_reflections.sql']) targetQuery(target, migration(file));
  targetQuery(target, "ALTER TABLE stories ADD COLUMN story_type text DEFAULT 'personal_journal'; ALTER TABLE stories ADD COLUMN parent_story_id uuid REFERENCES stories(id); ALTER TABLE story_metadata ADD COLUMN actionable_advice text;");
  for (const file of ['012_add_subscriptions_and_payments.sql', '010_create_notifications_table.sql', '017_add_subscription_notification_type.sql', '018_atomic_counter_rpcs.sql']) targetQuery(target, migration(file));
  const safety = migration('019_create_content_safety_and_account_deletion.sql');
  const boundary = safety.indexOf('CREATE OR REPLACE FUNCTION block_user');
  assert.ok(boundary > 0);
  targetQuery(target, safety.slice(0, boundary));
  targetQuery(target, `ALTER TABLE users DROP COLUMN updated_at;
    ALTER TABLE stories ALTER COLUMN author_id DROP NOT NULL;
    ALTER TABLE stories ALTER COLUMN title DROP NOT NULL;
    ALTER TABLE stories ALTER COLUMN content DROP NOT NULL;
    ALTER TABLE stories ADD COLUMN numeric_id bigserial NOT NULL;
    INSERT INTO stories(author_id,title,content) VALUES(NULL,NULL,NULL);
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY);
    INSERT INTO supabase_migrations.schema_migrations VALUES('019') ON CONFLICT DO NOTHING;
    CREATE TABLE public.rehearsal_duplicates(value text, payload json);
    INSERT INTO public.rehearsal_duplicates VALUES('synthetic-private-value','{"a": 1}'),('synthetic-private-value','{"a": 1}'),(NULL,NULL);
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;`);
}
