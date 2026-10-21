# DevBook — Editor Concurrency & Data Integrity Report

**Environment Tested:** InsForge TEST Project `devbook-rls-test` (`2a222ddf-f2a8-4307-91d4-6177fa473381`) and Local Client Test Harness  
**Files Audited:**
- `src/lib/step-content.ts`
- `src/services/db.ts`
- `src/routes/books/BookEditorPage.tsx`
- `mcp/proposals/rls-hardening/frontend-tests/editor-save.test.ts`
**Auditor Role:** Senior Application Security Engineer & PostgreSQL Backend Specialist  
**Evaluation Date:** 2026-10-20  

---

## 1. Executive Summary & Root Cause Analysis

### Prior Defect (F21)
In the original website implementation:
1. `BookEditorPage.tsx` built editor state without `publishedMarkdown`, keeping only editable `markdown`.
2. On every autosave keystroke, `syncDatabase` transmitted the whole step `content` object back to the database with `publishedMarkdown: undefined`.
3. Because JSON serialization strips keys whose values are `undefined`, `publishedMarkdown` was silently deleted from the PostgreSQL `jsonb` column.
4. Because `content.status` remained `'Published'`, the reader fallback rules immediately served the unapproved, in-progress draft text to readers.
5. Furthermore, updates used an unconditional `UPDATE steps SET content = ... WHERE id = $id`, allowing a stale editor tab to silently overwrite newer edits or concurrent publications without conflict detection.

### Remediated Architecture
The remediation implements a multi-layer defense ensuring genuine atomicity and safe merging:
1. **Field Isolation:** `src/lib/step-content.ts` establishes `DRAFT_CONTENT_KEYS` (`markdown`, `slug`, `description`, `difficulty`, `estimatedTime`, `visibility`). Autosaves call `draftContentPatch()`, which strictly strips `publishedMarkdown` and `status`. Only explicit "Publish" user actions can modify publication fields.
2. **Safe Server Merge:** `mergeStepContent()` merges draft patches on top of the server's current JSON, preserving unmentioned keys (e.g. `publishedMarkdown`, custom metadata).
3. **Atomic Compare-and-Set (CAS):** `DBService.updateStep()` executes an atomic single-statement SQL update checking `WHERE id = $id AND updated_at = $previous_timestamp`.
4. **Optimistic Concurrency Control (OCC):** If another session or tab updated the row concurrently, the database updates 0 rows. The client detects `data.length === 0`, re-reads the fresh server row (including any concurrent publication or draft updates), merges the changes, and retries up to 3 times before failing closed with a clean error.

---

## 2. Deep Dive: Atomicity Mechanism & SQL Generation

### Generated Query & Execution Flow
In `src/services/db.ts`:
```typescript
const { data, error } = await insforge.database
  .from("steps")
  .update({ ...updates, content })
  .eq("id", stepId)
  .eq("updated_at", current.updated_at)
  .select();
```

Over the network, PostgREST translates this client call to:
```http
PATCH /rest/v1/steps?id=eq.<stepId>&updated_at=eq.<current.updated_at> HTTP/1.1
Prefer: return=representation
Content-Type: application/json
```

In PostgreSQL, the query executes as a single atomic DML statement:
```sql
UPDATE public.steps
   SET title = $1,
       position = $2,
       content = $3
 WHERE id = $4
   AND updated_at = $5
RETURNING *;
```

### Evaluation of Concurrency Invariants

| Concurrency Check | Technical Reality in DevBook | Concurrency Guarantee |
|---|---|---|
| **Is `updated_at` part of the atomic update predicate?** | Yes. Both `id = $4` and `updated_at = $5` are in the single `WHERE` clause. | **ATOMIC:** The database evaluates both conditions in one statement. |
| **Can a concurrent update happen between read and write?** | Yes. If Client B commits an update after Client A's read, `trigger_steps_audit` fires `BEFORE UPDATE` and sets `NEW.updated_at := now()`. | **DETECTED:** When Client A's update runs, PostgreSQL evaluates the tuple under `READ COMMITTED`. Since `updated_at` changed, the condition is `FALSE`. Exactly 0 rows match. |
| **Is a zero-row update distinguishable from success?** | Yes. The request sets `Prefer: return=representation` (`.select()`). Success returns an array of 1 row (`data.length === 1`). A zero-row conflict returns an empty array `[]` (`data.length === 0`). | **RELIABLE:** In `db.ts`, `if (data && data.length === 1) return data[0];` correctly catches empty returns and avoids silent false-positive success. |
| **Do retries reread and merge the latest server state?** | Yes. On conflict (`data.length === 0`), the loop re-reads: `select("content, updated_at").eq("id", stepId).single()`. | **SAFE MERGE:** `mergeStepContent` overlays the draft patch on the freshly committed content, preserving any concurrent publication or metadata updates. |
| **Can identical timestamps defeat conflict detection?** | PostgreSQL `updated_at` is `timestamptz` with microsecond precision (`now() = transaction_timestamp()`). | **TESTED:** PostgREST preserves microseconds (e.g. `2026-10-20T13:51:36.641665+00:00`). Two discrete network requests execute in separate transactions with distinct timestamps. |
| **Can autosave overwrite `publishedMarkdown` or `status`?** | No. `draftContentPatch()` omits both keys. `mergeStepContent()` preserves existing server values. | **DATA INTEGRITY:** Autosave never alters publication state. |
| **Can publication and editor autosaves race?** | Handled safely. If publish commits first, autosave detects CAS conflict, re-reads the published text, merges the draft text, and writes without rolling back publication. If autosave commits first, publish's explicit action overwrites `publishedMarkdown` as intended. | **NO RACE LOSS:** Neither draft nor published markdown is lost. |

---

## 3. Empirical Verification Evidence

### 1. Automated Regression Suite (`editor-save.test.ts`)
Run command:
```powershell
$env:T_DIR="mcp/proposals/rls-hardening/frontend-tests"; node mcp/proposals/rls-hardening/frontend-tests/build-editor.mjs; node mcp/proposals/rls-hardening/frontend-tests/out-editor/editor-save.test.js
```
Results (9/9 passed):
- Test 1: Loading a published step returns draft and published Markdown separately — **PASS**
- Test 2: Autosaving an edit changes the draft only; published text and status are unchanged — **PASS**
- Test 3: A published step WITHOUT publishedMarkdown stays without it (no unapproved draft is published) — **PASS**
- Test 4: Legacy/malformed content: undefined values never delete keys, odd types preserved — **PASS**
- Test 5: An ordinary save cannot publish implicitly (keys stripped from patch) — **PASS**
- Test 6: A stale editor cannot roll back newer published content (simulated concurrent publication) — **PASS**
- Test 7: Explicit publish still works (sets `publishedMarkdown` and `status`) — **PASS**
- Test 8: Repeated conflicts end in a clear error and write nothing — **PASS**
- Test 9: Updates without content keep the fast single-statement path — **PASS**

### 2. Live TEST Database CAS Verification
Executed against the live InsForge TEST database (`devbook-rls-test`):
```javascript
// Step ID: 7d250b88-e91c-429a-a1a1-2670aa4b2356
Original step updated_at: 2026-10-18T18:42:51.47039+00:00

// 1. Attempt CAS update with a stale timestamp:
const { data: staleUpdate } = await client.database
  .from('steps')
  .update({ title: step.title })
  .eq('id', step.id)
  .eq('updated_at', '2020-01-01T00:00:00.000000+00:00')
  .select();
// Output: Stale CAS update rows returned: 0

// 2. Attempt CAS update with valid current timestamp:
const { data: validUpdate } = await client.database
  .from('steps')
  .update({ title: step.title })
  .eq('id', step.id)
  .eq('updated_at', step.updated_at)
  .select();
// Output: Valid CAS update rows returned: 1
// Output: New updated_at after trigger: 2026-10-20T13:51:36.641665+00:00
```
**Conclusion:** Compare-and-set semantics are enforced by PostgreSQL and PostgREST. Stale updates return 0 rows.

---

## 4. Browser Verification Status

- **Status:** **LOCAL & DATABASE VERIFIED / BROWSER NOT TESTED**
- **Rationale:** While TypeScript type-checks (`tsc -b`), bundler builds (`vite build`), unit tests, and live remote database CAS updates all pass, no TEST website frontend is deployed. In accordance with safety rules, no fake deployment was created. Browser UI end-to-end rendering remains to be verified during formal production staging.
