-- =============================================================================
-- Round 5 Hardening: Drop legacy duplicate RLS policies
-- =============================================================================
--
-- WHAT THIS FIXES:
--
-- The "multiple_permissive_policies" WARN fires when multiple SELECT/INSERT/
-- UPDATE policies cover the same role+action on a table. Postgres evaluates
-- ALL of them per row — unnecessary overhead and query plan noise.
--
-- The following "Users can ..." policies are early-generation generic ownership
-- checks that were superseded by the current role-specific named policies
-- (Author/Admin/Industry). They are now dead weight. DROP them.
--
-- SAFE TO DROP — verified against the overlap matrix:
--
-- access_log
--   DROP: "Users can view own access logs"       — (auth.uid() = user_id)
--   KEPT: "Author: view own access logs"         — same check + role guard
--   KEPT: "Admin: view all access logs"          — admin path
--
-- evaluations
--   DROP: "Users can view own evaluations"       — (auth.uid() = user_id)
--   KEPT: "Author: view evaluations for own..."  — same check + role guard
--   KEPT: "Admin/Industry: view..." policies     — admin/industry paths
--
-- manuscripts (SELECT)
--   DROP: "Users can view own manuscripts"       — (auth.uid() = user_id)
--   KEPT: "Author: view own manuscripts"         — created_by check + role guard
--   KEPT: "Admin/Industry: view..." policies
--
-- manuscripts (INSERT)
--   DROP: "Users can insert own manuscripts"     — (auth.uid() = user_id)
--   KEPT: "Author: insert own manuscripts"       — created_by check + role guard
--
-- manuscripts (UPDATE)
--   DROP: "Users can update own manuscripts"     — (auth.uid() = user_id)
--   KEPT: "Author: update own manuscripts"       — created_by check + role guard
--
-- NOT DROPPED (only policy on their table+cmd — no overlap):
--   change_proposals, diagnostic_findings, manuscript_versions,
--   revision_sessions, wave_runs — all "Users can ..." policies there are
--   the sole policy and are not causing multiple_permissive_policies warnings.
--
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own access logs"   ON public.access_log;
DROP POLICY IF EXISTS "Users can view own evaluations"   ON public.evaluations;
DROP POLICY IF EXISTS "Users can view own manuscripts"   ON public.manuscripts;
DROP POLICY IF EXISTS "Users can insert own manuscripts" ON public.manuscripts;
DROP POLICY IF EXISTS "Users can update own manuscripts" ON public.manuscripts;
