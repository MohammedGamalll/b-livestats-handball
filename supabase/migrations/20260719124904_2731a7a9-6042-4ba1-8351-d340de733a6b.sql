ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.match_events ADD COLUMN IF NOT EXISTS zone text;