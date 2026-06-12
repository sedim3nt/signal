PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generated_at TEXT NOT NULL,
  cutoff TEXT NOT NULL,
  video_count INTEGER NOT NULL,
  active_channel_count INTEGER NOT NULL,
  warning_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT,
  channel_id TEXT,
  url TEXT,
  tier TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  cadence TEXT,
  why_watch TEXT,
  lens TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS channel_topics (
  channel_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, topic_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  source_channel_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT,
  published_date TEXT,
  duration_seconds INTEGER,
  thumbnail TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  transcript_status TEXT NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_topics (
  video_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  PRIMARY KEY (video_id, topic_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summaries (
  video_id TEXT PRIMARY KEY,
  tldr TEXT,
  portfolio_signal TEXT,
  career_signal TEXT,
  alpha_json TEXT NOT NULL,
  bullets_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coverage_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warning TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS narratives (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  strength INTEGER NOT NULL DEFAULT 0,
  momentum TEXT,
  why_it_matters TEXT,
  watch_next_json TEXT NOT NULL,
  generated_at TEXT
);

CREATE TABLE IF NOT EXISTS narrative_topics (
  narrative_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  PRIMARY KEY (narrative_id, topic_id),
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS narrative_evidence (
  narrative_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (narrative_id, video_id),
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at);
CREATE INDEX IF NOT EXISTS idx_videos_score ON videos(score);
CREATE INDEX IF NOT EXISTS idx_video_topics_topic ON video_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_narratives_strength ON narratives(strength);
