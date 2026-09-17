CREATE TABLE public.tournament_settings (
  key text PRIMARY KEY,
  points_win integer NOT NULL DEFAULT 3,
  points_draw integer NOT NULL DEFAULT 1,
  points_loss integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_settings TO authenticated;
GRANT ALL ON public.tournament_settings TO service_role;
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can read tournament_settings" ON public.tournament_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can write tournament_settings" ON public.tournament_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.tournament_settings (key, points_win, points_draw, points_loss)
VALUES ('default', 3, 1, 0)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.team_bonuses (
  team_name text PRIMARY KEY,
  bonus_08 integer NOT NULL DEFAULT 0,
  bonus_10 integer NOT NULL DEFAULT 0,
  bonus_tp integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_bonuses TO authenticated;
GRANT ALL ON public.team_bonuses TO service_role;
ALTER TABLE public.team_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can read team_bonuses" ON public.team_bonuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can write team_bonuses" ON public.team_bonuses FOR ALL TO authenticated USING (true) WITH CHECK (true);