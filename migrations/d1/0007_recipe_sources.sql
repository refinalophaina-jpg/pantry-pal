-- Weekly TheMealDB mirror runs under the same lease pattern as the food catalog.
INSERT INTO catalog_jobs(name) VALUES ('themealdb') ON CONFLICT(name) DO NOTHING;
-- Cached external recipes (TheMealDB mirror, Spoonacular) are found by their source key.
CREATE INDEX IF NOT EXISTS recipe_catalog_source ON recipe_catalog(source, source_id);
