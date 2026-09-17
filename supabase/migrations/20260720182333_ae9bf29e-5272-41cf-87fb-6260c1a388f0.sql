ALTER TABLE public.tournament_settings
  ALTER COLUMN points_win  TYPE numeric USING points_win::numeric,
  ALTER COLUMN points_draw TYPE numeric USING points_draw::numeric,
  ALTER COLUMN points_loss TYPE numeric USING points_loss::numeric;

ALTER TABLE public.team_bonuses DROP COLUMN IF EXISTS bonus_tp;