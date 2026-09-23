-- Private recipe photos (uploads and generated illustrations) per household.
-- Small, bounded blobs; membership is checked on every read and write.
CREATE TABLE household_images (
 id TEXT PRIMARY KEY,
 household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 created_by TEXT NOT NULL,
 media_type TEXT NOT NULL CHECK(media_type IN ('image/jpeg','image/png','image/webp')),
 purpose TEXT NOT NULL DEFAULT 'upload' CHECK(purpose IN ('upload','generated')),
 size INTEGER NOT NULL CHECK(size > 0 AND size <= 900000),
 bytes BLOB NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX household_images_household ON household_images(household_id, created_at);
