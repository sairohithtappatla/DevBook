# Migrations applied to the TEST project (devbook-rls-test) — history only

These are the exact files `insforge db migrations up` applied to TEST (2026-10-20/21): the reviewed SQL from `../../` with
`BEGIN;`/`COMMIT;` removed. They are a record, NOT the production set:
- `20261020133321_secure-attachment-storage.sql` is migration 09 **revision 1** (superseded: it allowed every operation on other
  buckets); TEST was corrected by the two `secure-attachment-storage-v2*` files (revision 2.1).
- 01–04 were applied to TEST earlier by another method and are not in this list.
For production, create fresh migration files from the reviewed `final/*.sql` in the production folder, in the order of
`final/PRODUCTION-RUNBOOK.md`. Never run `db migrations up --all` with these files in a production-linked folder.
