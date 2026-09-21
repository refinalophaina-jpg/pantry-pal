-- Fence completion so a delayed invocation cannot release a newer job's lease.
ALTER TABLE catalog_jobs ADD COLUMN lease_token TEXT;
