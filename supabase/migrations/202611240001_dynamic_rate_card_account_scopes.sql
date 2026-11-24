-- Allow one source card per actual provider account while keeping the
-- historical 04/08/other scopes intact. Provider account names are stored
-- normalized by the API (uppercase, single-spaced).
ALTER TABLE public.rate_cards
  DROP CONSTRAINT IF EXISTS rate_cards_account_code_check;

ALTER TABLE public.rate_cards
  ADD CONSTRAINT rate_cards_account_code_check
  CHECK (
    account_code IN ('04', '08', 'other')
    OR account_code ~ '^[A-Z0-9][A-Z0-9 ._-]{1,99}$'
  );

CREATE INDEX IF NOT EXISTS rate_cards_client_scope_updated_idx
  ON public.rate_cards (client_id, account_code, updated_at DESC);
