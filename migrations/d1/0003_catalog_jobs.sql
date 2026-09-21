CREATE TABLE catalog_jobs (
 name TEXT PRIMARY KEY,
 lease_until INTEGER NOT NULL DEFAULT 0,
 last_started_at TEXT,
 last_finished_at TEXT,
 last_status TEXT,
 requested INTEGER NOT NULL DEFAULT 0,
 updated INTEGER NOT NULL DEFAULT 0,
 missing INTEGER NOT NULL DEFAULT 0
);
INSERT INTO catalog_jobs(name) VALUES ('openfoodfacts');
