-- Store the validated, structured matrix extracted from CSV/XLSX source cards.
-- The original private object remains the audit source of truth.
ALTER TABLE public.rate_cards
  ADD COLUMN IF NOT EXISTS normalized_matrix_json jsonb;

ALTER TABLE public.rate_cards
  ADD COLUMN IF NOT EXISTS normalization_status text NOT NULL DEFAULT 'manual_review';

ALTER TABLE public.rate_cards
  DROP CONSTRAINT IF EXISTS rate_cards_normalization_status_check;

ALTER TABLE public.rate_cards
  ADD CONSTRAINT rate_cards_normalization_status_check
  CHECK (normalization_status IN ('normalized', 'manual_review', 'failed'));
