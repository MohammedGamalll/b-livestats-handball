
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  short_name text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct teams" ON public.teams FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE public.team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  no text NOT NULL,
  name text,
  surname text,
  position text,
  captain boolean DEFAULT false,
  playing boolean DEFAULT false,
  height text,
  add_info text
);
GRANT ALL ON public.team_players TO service_role;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct team_players" ON public.team_players FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX team_players_team_id_idx ON public.team_players(team_id);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition text,
  date text,
  venue text,
  city text,
  country text,
  half_length integer,
  halves integer,
  team1_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team2_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team1_name text NOT NULL,
  team2_name text NOT NULL,
  team1_color text,
  team2_color text,
  team1_snapshot jsonb NOT NULL,
  team2_snapshot jsonb NOT NULL,
  score1 integer NOT NULL DEFAULT 0,
  score2 integer NOT NULL DEFAULT 0,
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct matches" ON public.matches FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  ts bigint NOT NULL,
  team smallint,
  player_no text,
  action text NOT NULL,
  half integer,
  clock text,
  x double precision,
  y double precision,
  goal_x double precision,
  goal_y double precision,
  miss_zone text,
  subtype text,
  assist_no text,
  rebound_no text,
  rebound_team smallint,
  involver_no text,
  fast_break boolean,
  defense text
);
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct match_events" ON public.match_events FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX match_events_match_id_idx ON public.match_events(match_id);
CREATE INDEX match_events_player_idx ON public.match_events(team, player_no);
