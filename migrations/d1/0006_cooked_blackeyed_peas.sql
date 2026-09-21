-- USDA FDC 173759, SR Legacy, retrieved 2026-09-21; CC0.
-- Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, without salt
INSERT INTO ingredients (id,slug,name,category,source,source_id,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('fdc-173759','fdc-173759','Cooked black-eyed peas','Legumes & Nuts','usda','173759',116,7.73,20.8,0.53,6.5) ON CONFLICT(slug) DO NOTHING;
