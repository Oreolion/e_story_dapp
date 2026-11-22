-- Private app data goes through authenticated server APIs. Preserve managed
-- Auth/Storage and extension objects; do not change their ownership or ACLs.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
DO $permissions$
DECLARE item record;
BEGIN
  FOR item IN SELECT c.oid,c.relname,c.relkind FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','S')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
  LOOP
    IF item.relkind <> 'S' THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',item.relname);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',item.relname);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',item.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC,anon,authenticated',item.relname);
      EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role',item.relname);
    END IF;
  END LOOP;
  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',item.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',item.signature);
  END LOOP;
END;
$permissions$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
-- A schema-scoped revoke cannot cancel PostgreSQL's global PUBLIC default.
-- Restrict future functions created by this bootstrap owner as well.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
REVOKE ALL ON supabase_migrations.schema_migrations FROM PUBLIC,anon,authenticated;

-- Local fresh fixture metadata only. Managed hosted bucket provisioning still
-- needs the provider-supported setup path and target-specific approval.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('story-audio','story-audio',false,10485760,ARRAY['audio/webm','audio/mpeg','audio/mp4','audio/ogg','audio/wav']);
CREATE POLICY istory_audio_insert_via_server ON storage.objects AS RESTRICTIVE
  FOR INSERT TO anon,authenticated WITH CHECK(bucket_id <> 'story-audio');
CREATE POLICY istory_audio_update_via_server ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO anon,authenticated USING(bucket_id <> 'story-audio') WITH CHECK(bucket_id <> 'story-audio');
