-- Lock down anon-readable tables (public.transcript_chunks, public.webhook_events)
--
-- Why: Supabase flags both tables as UNRESTRICTED — RLS disabled, so anyone
-- holding the public anon key (shipped in the browser bundle) can read them.
-- transcript_chunks holds private user conversation content and webhook_events
-- holds raw provider payloads, so both are sensitive.
--
-- What: enable RLS with NO policies (default-deny). The anon and authenticated
-- roles then get zero rows and no writes. Every legitimate reader/writer of
-- these tables is server-side code using the service role key, which bypasses
-- RLS, so the app is unaffected:
--   transcript_chunks -> lib/search/similarity-search.ts (service-role client),
--     called from app/api/chat and app/api/suzy/chat route handlers only;
--     scripts/ingest-documents/upload-to-supabase.ts (service-role CLI).
--   webhook_events -> lib/ghl/webhook-handler.ts (service-role client only).
-- Verified: no importer of the anon browser client (lib/supabase/client.ts) or
-- the anon server client (lib/supabase/server.ts) references either table.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent: re-running on a
-- table that already has RLS is a no-op, not an error.

ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
