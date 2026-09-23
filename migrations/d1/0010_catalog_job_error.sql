-- Keep the reason a scheduled job failed (or lost letters) next to its counters,
-- so a deployment's cron can be diagnosed from the job row rather than from logs.
ALTER TABLE catalog_jobs ADD COLUMN last_error TEXT;
