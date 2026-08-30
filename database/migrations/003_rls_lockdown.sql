# ==============================================================================
# SPOT — RLS LOCKDOWN (apply AFTER the API server is deployed and
# PUBLIC_API_BASE is set on the frontend host).
#
# Locks the public anon key down to READ-ONLY so nobody can delete/steal data
# through the browser. All writes must now go through apps/server (which uses
# the database directly and bypasses RLS). Run this in Supabase SQL Editor.
# ==============================================================================

-- 1. CITIZENS: keep public reads, DROP all public writes
DROP POLICY IF EXISTS "Public delete citizens" ON public.citizens;
DROP POLICY IF EXISTS "Public update citizens" ON public.citizens;
DROP POLICY IF EXISTS "Public insert citizens" ON public.citizens;

-- 2. SPOTS: keep public reads, DROP public updates (prevents spot stealing)
DROP POLICY IF EXISTS "Public update spots" ON public.spots;

-- 3. Prevent session-token hijacking: anon can no longer read session_token_hash
REVOKE SELECT (session_token_hash) ON public.citizens FROM anon, authenticated;

-- 4. MODERATION_FLAGS: server-only. Enable RLS with no policies => anon denied,
--    while the server (table owner) still has full access.
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;

-- 5. Make visitor counter RPC callable by anon without table UPDATE rights
--    (recreate as SECURITY DEFINER if it already exists).
CREATE OR REPLACE FUNCTION public.increment_visitors()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.site_stats
  SET value = value + 1
  WHERE key = 'total_visitors'
  RETURNING value;
$$;
REVOKE ALL ON FUNCTION public.increment_visitors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_visitors() TO anon, authenticated;
