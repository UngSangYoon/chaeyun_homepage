CREATE TABLE IF NOT EXISTS published_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);
