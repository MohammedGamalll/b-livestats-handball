GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_bonuses TO anon, authenticated;

DROP POLICY IF EXISTS "no direct teams" ON public.teams;
DROP POLICY IF EXISTS "no direct team_players" ON public.team_players;
DROP POLICY IF EXISTS "no direct matches" ON public.matches;
DROP POLICY IF EXISTS "no direct match_events" ON public.match_events;

CREATE POLICY "allow all teams" ON public.teams FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "allow all team_players" ON public.team_players FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "allow all matches" ON public.matches FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "allow all match_events" ON public.match_events FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app-assets', 'app-assets', true, 52428800, ARRAY['image/png','image/jpeg','image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read app-assets" ON storage.objects;
CREATE POLICY "public read app-assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'app-assets');
