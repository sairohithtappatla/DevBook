-- READ-ONLY catalog queries for the TEST project (SELECT only; no quotes other than single quotes; no percent signs).
-- Each block starts with a "-- Q<n>:" line and holds exactly one statement. run-readonly.mjs refuses anything else.

-- Q1: server version and the roles involved
SELECT version() AS version, current_user AS me, session_user AS session_user_, (SELECT string_agg(concat(rolname, CASE WHEN rolbypassrls THEN '+bypassrls' ELSE '' END, CASE WHEN rolsuper THEN '+super' ELSE '' END), ', ' ORDER BY rolname) FROM pg_roles WHERE rolname IN ('anon','authenticated','postgres','project_admin','authenticator','service_role')) AS roles

-- Q2: owner, security mode, search_path and ACL of every function this proposal touches or calls
SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer, p.provolatile AS volatility, coalesce(array_to_string(p.proconfig, ' '), '') AS config, coalesce(p.proacl::text, 'default (PUBLIC execute)') AS acl, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('can_read_book','can_discover_book','can_view_drafts','can_edit_book','can_delete_book','can_manage_members','get_book_id_for_phase','get_book_id_for_step','step_is_reader_visible','reader_markdown','reader_step_json','reader_book_tree','trigger_audit_metadata','trigger_add_book_owner') ORDER BY p.proname

-- Q3: does the owner of each of those functions bypass RLS? (definer functions and owner-rights views need this)
SELECT DISTINCT pg_get_userbyid(p.proowner) AS function_owner, r.rolsuper AS superuser, r.rolbypassrls AS bypassrls FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_roles r ON r.oid = p.proowner WHERE n.nspname = 'public' AND p.proname IN ('can_read_book','can_edit_book','reader_book_tree','can_discover_book')

-- Q4: tables and views in public: owner, RLS on, RLS forced, view options, ACL
SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls_on, c.relforcerowsecurity AS rls_forced, coalesce(array_to_string(c.reloptions, ' '), '') AS options, coalesce(c.relacl::text, '') AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p') ORDER BY c.relkind, c.relname

-- Q5: who may create objects in schema public (search_path hijack precondition) and in auth
SELECT 'anon' AS role_name, has_schema_privilege('anon', 'public', 'CREATE') AS can_create_in_public UNION ALL SELECT 'authenticated', has_schema_privilege('authenticated', 'public', 'CREATE')

-- Q6: default privileges that decide whether NEW functions are executable by anon/authenticated
SELECT pg_get_userbyid(d.defaclrole) AS for_role, coalesce(n.nspname, 'all schemas') AS schema_name, d.defaclobjtype AS object_type, d.defaclacl::text AS acl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace ORDER BY 1, 2, 3

-- Q7: all RLS policies on the proposal tables (compare with 03_policy_switch.sql / 03_rollback.sql)
SELECT tablename, policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('books','phases','steps','attachments','book_members','book_access','book_revisions','book_progress','step_progress','users','user_followers') ORDER BY tablename, policyname

-- Q8: column privileges that bypass RLS thinking: can anon/authenticated read the search_vector column or tables directly?
SELECT has_table_privilege('anon', 'public.steps', 'SELECT') AS anon_select_steps, has_table_privilege('authenticated', 'public.steps', 'SELECT') AS auth_select_steps, has_table_privilege('anon', 'public.reader_steps', 'SELECT') AS anon_select_reader_steps, has_table_privilege('anon', 'public.books', 'INSERT') AS anon_insert_books

-- Q9: storage objects metadata table (if the backend keeps one in the database) and its policies
SELECT n.nspname, c.relname, c.relrowsecurity AS rls_on FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('storage','_storage') AND c.relkind = 'r' ORDER BY 1, 2

-- Q10: row counts only (no content), to size the fixture
SELECT (SELECT count(*) FROM books) AS books, (SELECT count(*) FROM phases) AS phases, (SELECT count(*) FROM steps) AS steps, (SELECT count(*) FROM book_members) AS members, (SELECT count(*) FROM attachments) AS attachments
