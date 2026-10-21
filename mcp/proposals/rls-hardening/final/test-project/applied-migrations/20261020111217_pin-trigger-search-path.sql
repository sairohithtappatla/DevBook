-- Step 6 (independent, any time): pin the search_path of the one SECURITY DEFINER function that has none. PROPOSAL.
-- NOT APPLIED to any real backend. Finding S2 (review 2026-10-20): trigger_add_book_owner() runs with its owner's rights
-- (it inserts the OWNER row into book_members) but resolves names through the caller's search_path. Every other definer
-- function already pins 'public, pg_temp'. Body unchanged; only the function's configuration changes.
ALTER FUNCTION public.trigger_add_book_owner() SET search_path = public, pg_temp;
