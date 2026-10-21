# DevBook — Production Preflight & Release Runbook

> [!WARNING]
> **PLANNING DOCUMENT ONLY.**  
> Do not execute these steps without formal, explicit owner authorization.  
> Production Project: `6ktij8hk` (Website: `https://devbook.rohith.engineer`).  
> Never run migrations or deployments against production during audit/testing phases.

---

## 1. Release Architecture & Principles

1. **Zero Downtime:** Schema migrations and application releases are ordered so that existing readers and editors experience no downtime or transient authorization errors.
2. **Fail Closed:** Every permission predicate, storage policy, and editor update fails closed on error or ambiguity.
3. **Additive First:** All additive database functions and RPCs are deployed before switching active RLS policies.
4. **Editor Safety First:** The website editor data integrity fix is deployed before locking down database policies.
5. **No MCP Writes in Initial Release:** All 4 MCP feature flags remain `false` (`DEVBOOK_MCP_WRITE_TOOLS`, `DEVBOOK_MCP_PUBLISH_TOOL`, `DEVBOOK_MCP_DURABLE_LIMITS`, `DEVBOOK_MCP_DURABLE_AUDIT`). Active tokens must be 0.

---

## 2. Preflight Checklist (Gate A)

### Step 1: Conclusive Project Identity Verification
Before executing any remote operation, confirm the target project identity:
```bash
# Verify currently active InsForge project
npx -y @insforge/cli current
```
**Expected Output:**
- Project ID: `6ktij8hk` (or configured production project ID)
- If the current project indicates `devbook-rls-test` or `393cz2pc`, **STOP IMMEDIATELY**.

Database identity query:
```sql
SELECT current_database(), current_user, inet_server_addr();
```

### Step 2: Full Pre-Release Backup
Create a production snapshot and confirm its completion before touching the database:
```bash
npx -y @insforge/cli backups create --name pre-v2-hardening-prod --wait
```
Confirm backup is listed with status `completed`:
```bash
npx -y @insforge/cli backups list
```
**Record Backup ID:** `________________________________________`

> [!IMPORTANT]
> **Restore Caveat:** `insforge backups restore <backupId>` overwrites all current database data. Ensure this backup ID is permanently archived before proceeding.

### Step 3: Read-Only Database Sizing (Queries Q1–Q12)
Execute `mcp/proposals/rls-hardening/preflight/readonly-queries.sql` via read-only connection:
- **Q1–Q4:** Confirm counts of existing books by `publication_status` and `access_level`.
- **Q10:** Confirm total count of steps and attachments.
- **Q11:** Count legacy status-less steps in PUBLISHED books (this determines the expected freeze count for `02b`).
- **Q12:** Count steps marked `'Published'` without `publishedMarkdown` (must NOT be frozen by `02b`).

---

## 3. Ordered Production Rollout (Gate B)

### Phase 1: Database Additive Functions
Apply the helper predicates and reader RPCs:
1. Apply `mcp/proposals/rls-hardening/final/01_access_predicates.sql`
   - Creates `can_read_book()`, `can_discover_book()`, `can_view_drafts()`, `can_manage_members()`.
2. Apply `mcp/proposals/rls-hardening/final/02_reader_objects.sql`
   - Creates `reader_book_tree()`, `reader_step_json()`, `reader_markdown()`, and reader views.
3. Validate: Run `SELECT public.can_read_book('00000000-0000-0000-0000-000000000000', NULL);` (returns `FALSE`).

### Phase 2: Data Integrity & Reader Hardening
1. Apply `mcp/proposals/rls-hardening/final/02b_legacy_step_freeze.sql`
   - Freezes status-less legacy steps.
   - Confirm NOTICE message matches Q11 count: `02b: froze X legacy step(s)`.
   - Confirm table `_rls02b_step_freeze_backup` is populated and closed to public/anon.
2. Apply `mcp/proposals/rls-hardening/final/07_strict_reader_rule.sql`
   - Replaces `reader_markdown()` with strict rule (serving only explicit `publishedMarkdown`).
   - If any unfrozen status-less step exists, it aborts cleanly with an exception.
3. Apply `mcp/proposals/rls-hardening/final/06_pin_trigger_search_path.sql`
   - Pins `search_path = public, pg_temp` on `trigger_add_book_owner()`.

### Phase 3: Website Application Deployment
Deploy the updated frontend application before switching policies:
1. Verify branch `v2` builds cleanly:
   ```bash
   npm run build
   ```
2. Deploy the frontend bundle to production hosting (`https://devbook.rohith.engineer`).
3. Verify client loads cleanly in an incognito window without console errors.

### Phase 4: Policy Switch & Storage Lockdown
1. Apply `mcp/proposals/rls-hardening/final/03_policy_switch.sql`
   - Switches RLS policies on `books`, `phases`, `steps`.
2. Apply `mcp/proposals/rls-hardening/final/04_helper_guard.sql`
   - Enforces `req_user_id = auth.uid()` on all helper predicates.
3. Apply `mcp/proposals/rls-hardening/final/08_hide_draft_only_phases.sql`
   - Rewrites `select_phases` policy using `phase_is_reader_visible()`.
4. Apply `mcp/proposals/rls-hardening/final/09_secure_attachment_storage.sql`
   - Enables RLS on `storage.objects` and applies `can_access_attachment_object()`.
5. Reload PostgREST schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

---

## 4. Post-Deployment Role-Based Smoke Tests

Execute these verification checks immediately following Phase 4:

| Role | Test Target | Action / URL | Expected Result |
|---|---|---|---|
| **Anonymous** | Public Book | Open public book reader page | 200 OK; reader tree renders published steps only. |
| **Anonymous** | Draft-Only Phase | Inspect network response for `/phases` | Returns 0 draft phases. |
| **Anonymous** | Attachment Download | Download published step attachment | 200 OK; file downloads successfully. |
| **Anonymous** | Draft Attachment | Attempt download with known draft attachment key | 404 Not Found / Access Denied. |
| **Authenticated Stranger** | Another User's Draft Book | Navigate to draft book URL | 404 Not Found / Book invisible. |
| **Authenticated Stranger** | Known Attachment Key | Download draft attachment | 404 Not Found / Access Denied. |
| **Editor / Owner** | Draft Book | Open Book in Editor | 200 OK; all draft phases and steps visible. |
| **Editor / Owner** | Autosave Keystroke | Make draft text change and wait for autosave | Autosave succeeds; `publishedMarkdown` is preserved. |
| **Editor / Owner** | Publish Action | Click "Publish" | Status becomes "Published", `publishedMarkdown` updated. |

---

## 5. Rollback Procedures & Contingency Plans

### If Rollback is Triggered During Phase 1 or 2:
Execute in reverse order:
1. `06_rollback.sql`
2. `07_rollback.sql`
3. `02b_rollback.sql` (restores original step keys from `_rls02b_step_freeze_backup`)
4. `02_rollback.sql`
5. `01_rollback.sql`

### If Rollback is Triggered After Phase 4 (Policies Active):
Execute in strict reverse dependency order:
1. `09_rollback.sql` (disables storage RLS; note: re-exposes attachment keys)
2. `08_rollback.sql` (re-exposes draft phase titles)
3. `04_rollback.sql`
4. `03_rollback.sql` (restores legacy baseline RLS policies)
5. Redeploy prior frontend website bundle if necessary.
6. `06_rollback.sql`
7. `07_rollback.sql`
8. `02b_rollback.sql`
9. `02_rollback.sql`
10. `01_rollback.sql`

### Audit Evidence Preservation Rule
If migration `002_mcp_ops.sql` is ever in scope for rollback:
- **DO NOT** execute `002_rollback.sql` without exporting `public.mcp_audit_events` first!
- Dropping `mcp_audit_events` destroys the legal audit log. Always run `COPY public.mcp_audit_events TO STDOUT` beforehand.

---

## 6. Explicit Stop Conditions & Go/No-Go Criteria

Abort rollout and trigger rollback if any of the following occur:
1. **Preflight Failure:** Project verification fails, or backup cannot be verified as `completed`.
2. **Schema Mismatch:** Any migration fails with a PostgreSQL syntax or constraint error.
3. **Data Loss Warning:** `02b` reports 0 legacy steps frozen when preflight Q11 predicted >0 steps.
4. **Reader Outage:** Anonymous reader cannot render published books on live website.
5. **Autosave Regression:** Browser console reports HTTP 500 or JSON serialization failure on editor autosave.
6. **Storage Breach:** Unauthenticated request successfully downloads an asset from a draft step.
