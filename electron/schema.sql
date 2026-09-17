PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  short_name TEXT,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  no TEXT NOT NULL,
  name TEXT,
  surname TEXT,
  position TEXT,
  captain INTEGER DEFAULT 0,
  playing INTEGER DEFAULT 0,
  height TEXT,
  add_info TEXT
);
CREATE INDEX IF NOT EXISTS team_players_team_id_idx ON team_players(team_id);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  competition TEXT,
  season TEXT,
  date TEXT,
  venue TEXT,
  city TEXT,
  country TEXT,
  half_length INTEGER,
  halves INTEGER,
  team1_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  team2_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  team1_name TEXT NOT NULL,
  team2_name TEXT NOT NULL,
  team1_color TEXT,
  team2_color TEXT,
  team1_snapshot TEXT NOT NULL,
  team2_snapshot TEXT NOT NULL,
  score1 INTEGER NOT NULL DEFAULT 0,
  score2 INTEGER NOT NULL DEFAULT 0,
  shootout1 INTEGER,
  shootout2 INTEGER,
  finished_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  team INTEGER,
  player_no TEXT,
  action TEXT NOT NULL,
  half INTEGER,
  clock TEXT,
  x REAL,
  y REAL,
  goal_x REAL,
  goal_y REAL,
  miss_zone TEXT,
  subtype TEXT,
  assist_no TEXT,
  rebound_no TEXT,
  rebound_team INTEGER,
  involver_no TEXT,
  fast_break INTEGER,
  defense TEXT,
  zone TEXT
);
CREATE INDEX IF NOT EXISTS match_events_match_id_idx ON match_events(match_id);
CREATE INDEX IF NOT EXISTS match_events_player_idx ON match_events(team, player_no);

CREATE TABLE IF NOT EXISTS tournament_settings (
  key TEXT PRIMARY KEY,
  points_win REAL NOT NULL DEFAULT 1,
  points_draw REAL NOT NULL DEFAULT 0.5,
  points_loss REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_bonuses (
  team_name TEXT PRIMARY KEY,
  bonus_08 REAL NOT NULL DEFAULT 0,
  bonus_10 REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO tournament_settings (key, points_win, points_draw, points_loss)
VALUES ('default', 1, 0.5, 0);
