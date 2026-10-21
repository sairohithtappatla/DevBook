-- Rollback for 002_mcp_ops.sql. Turn DEVBOOK_MCP_DURABLE_LIMITS / DEVBOOK_MCP_DURABLE_AUDIT OFF first, otherwise writes fail
-- closed (BUSY) once the limit function is gone. Dropping mcp_audit_events DESTROYS the durable audit trail: export it first.
BEGIN;
DROP FUNCTION IF EXISTS public.mcp_rate_take(uuid, text, integer, integer);
DROP TABLE IF EXISTS public.mcp_rate_limits;
DROP TABLE IF EXISTS public.mcp_audit_events;
NOTIFY pgrst, 'reload schema';
COMMIT;
