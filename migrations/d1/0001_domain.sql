-- Application domain schema. Apply Better Auth's schema first (quoted "user" table).
-- Entity IDs and legacy identity mappings remain textual. Dates use ISO strings;
-- decimal quantities/nutrition use REAL, money is preserved without integer truncation.
PRAGMA foreign_keys = ON;
CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO app_metadata VALUES ('sync_epoch', lower(hex(randomblob(16))));
CREATE TABLE households (
  id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  created_by TEXT NOT NULL REFERENCES "user"(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK(sequence >= 0)
);
CREATE TABLE household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','member')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(household_id,user_id)
);
CREATE INDEX household_members_user ON household_members(user_id,joined_at);
CREATE TABLE household_invites (
  code TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL, used_by TEXT REFERENCES "user"(id), used_at TEXT
);
CREATE INDEX household_invites_household ON household_invites(household_id);
-- Transaction guard: an unsatisfied SQL precondition must throw rather than silently
-- update zero rows. Every successful batch removes its guard; failures roll it back.
CREATE TABLE mutation_assertions (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok = 1));
CREATE TABLE operation_receipts (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id), operation_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL, response TEXT NOT NULL CHECK(json_valid(response)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(household_id,user_id,operation_id)
);
CREATE TABLE legacy_identity_map (
  legacy_user_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id),
  claimed_at TEXT NOT NULL
);

CREATE TABLE pantry_items (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other',
quantity REAL NOT NULL CHECK(quantity >= 0 AND quantity <= 1000000),
unit TEXT NOT NULL CHECK(unit IN ('pcs','g','kg','ml','l','tbsp','tsp','cup')),
zone TEXT NOT NULL DEFAULT 'pantry' CHECK(zone IN ('pantry','fridge','freezer')),
expires_on TEXT, added_on TEXT NOT NULL DEFAULT (date('now')), notes TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0)
  
);
CREATE INDEX pantry_items_household ON pantry_items(household_id);
CREATE TRIGGER pantry_items_sequence_insert AFTER INSERT ON pantry_items
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER pantry_items_sequence_update AFTER UPDATE ON pantry_items
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER pantry_items_sequence_delete AFTER DELETE ON pantry_items
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity > 0 AND quantity <= 1000000),
unit TEXT NOT NULL CHECK(unit IN ('pcs','g','kg','ml','l','tbsp','tsp','cup')),
category TEXT NOT NULL DEFAULT 'Other', done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),
from_recipe TEXT, deal_price REAL CHECK(deal_price >= 0), deal_store TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0)
  
);
CREATE INDEX shopping_items_household ON shopping_items(household_id);
CREATE TRIGGER shopping_items_sequence_insert AFTER INSERT ON shopping_items
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER shopping_items_sequence_update AFTER UPDATE ON shopping_items
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER shopping_items_sequence_delete AFTER DELETE ON shopping_items
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE TABLE meal_plan (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date TEXT NOT NULL, meal TEXT NOT NULL CHECK(meal IN ('breakfast','lunch','dinner','snack')),
recipe_id TEXT NOT NULL, recipe_name TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0)
  
);
CREATE INDEX meal_plan_household ON meal_plan(household_id);
CREATE TRIGGER meal_plan_sequence_insert AFTER INSERT ON meal_plan
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER meal_plan_sequence_update AFTER UPDATE ON meal_plan
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER meal_plan_sequence_delete AFTER DELETE ON meal_plan
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_id TEXT, item_name TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity > 0),
unit TEXT NOT NULL, reason TEXT NOT NULL CHECK(reason IN ('used','wasted')),
at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0)
  
);
CREATE INDEX usage_events_household ON usage_events(household_id);
CREATE TRIGGER usage_events_sequence_insert AFTER INSERT ON usage_events
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER usage_events_sequence_update AFTER UPDATE ON usage_events
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER usage_events_sequence_delete AFTER DELETE ON usage_events
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE TABLE saved_recipes (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, cuisine TEXT, minutes INTEGER,
difficulty TEXT CHECK(difficulty IN ('easy','medium','hard')), servings INTEGER,
equipment TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(equipment)),
ingredients TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(ingredients)),
steps TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(steps)), tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags)),
external_id TEXT, image_url TEXT, area TEXT, source TEXT, video TEXT,
calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0)
  
);
CREATE INDEX saved_recipes_household ON saved_recipes(household_id);
CREATE TRIGGER saved_recipes_sequence_insert AFTER INSERT ON saved_recipes
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER saved_recipes_sequence_update AFTER UPDATE ON saved_recipes
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER saved_recipes_sequence_delete AFTER DELETE ON saved_recipes
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE TABLE stores (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, zip TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  UNIQUE(id,household_id)
);
CREATE INDEX stores_household ON stores(household_id);
CREATE TRIGGER stores_sequence_insert AFTER INSERT ON stores
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER stores_sequence_update AFTER UPDATE ON stores
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER stores_sequence_delete AFTER DELETE ON stores
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE TABLE item_locations (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL, item_name TEXT NOT NULL COLLATE NOCASE,
aisle TEXT, section TEXT, price REAL CHECK(price >= 0), updated_by TEXT REFERENCES "user"(id),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  FOREIGN KEY(store_id,household_id) REFERENCES stores(id,household_id) ON DELETE CASCADE,UNIQUE(store_id,item_name)
);
CREATE INDEX item_locations_household ON item_locations(household_id);
CREATE TRIGGER item_locations_sequence_insert AFTER INSERT ON item_locations
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER item_locations_sequence_update AFTER UPDATE ON item_locations
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=NEW.household_id; END;
CREATE TRIGGER item_locations_sequence_delete AFTER DELETE ON item_locations
BEGIN UPDATE households SET sequence=sequence+1 WHERE id=OLD.household_id; END;

CREATE INDEX pantry_expiry ON pantry_items(household_id,expires_on);
CREATE INDEX meal_plan_date ON meal_plan(household_id,date);
CREATE INDEX usage_events_at ON usage_events(household_id,at DESC);
CREATE TABLE ingredients (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other',
 aliases TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(aliases)), density_g_per_ml REAL, grams_per_piece REAL,
 calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL,
 source TEXT NOT NULL DEFAULT 'curated', source_id TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ingredients_name ON ingredients(name COLLATE NOCASE);
CREATE TABLE foods (
 id TEXT PRIMARY KEY, barcode TEXT UNIQUE, name TEXT NOT NULL, brand TEXT,
 category TEXT NOT NULL DEFAULT 'Other', ingredient_id TEXT REFERENCES ingredients(id) ON DELETE SET NULL,
 serving_size TEXT, calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL,
 source TEXT NOT NULL DEFAULT 'openfoodfacts', source_id TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX foods_name ON foods(name COLLATE NOCASE);
CREATE INDEX foods_ingredient ON foods(ingredient_id);
CREATE TABLE techniques (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'General',
 difficulty TEXT NOT NULL DEFAULT 'easy' CHECK(difficulty IN ('easy','medium','hard')),
 minutes INTEGER, summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
 tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags)), source TEXT NOT NULL DEFAULT 'curated',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE recipe_catalog (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 cuisine TEXT NOT NULL DEFAULT 'International', minutes INTEGER NOT NULL DEFAULT 30,
 difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
 servings INTEGER NOT NULL DEFAULT 2, equipment TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(equipment)),
 ingredients TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(ingredients)),
 steps TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(steps)), tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags)),
 image_url TEXT, area TEXT, source TEXT NOT NULL DEFAULT 'curated', source_id TEXT,
 calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX recipe_catalog_name ON recipe_catalog(name COLLATE NOCASE);
CREATE TABLE nutrition_cache (
 key TEXT PRIMARY KEY, display_name TEXT NOT NULL, source TEXT NOT NULL, source_id TEXT,
 per_unit TEXT NOT NULL DEFAULT '100g', calories REAL NOT NULL,
 protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL,
 fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE VIRTUAL TABLE ingredients_fts USING fts5(name, category, aliases, content='ingredients', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER ingredients_fts_insert AFTER INSERT ON ingredients BEGIN
 INSERT INTO ingredients_fts(rowid,name, category, aliases) VALUES(new.rowid,new.name, new.category, new.aliases); END;
CREATE TRIGGER ingredients_fts_delete AFTER DELETE ON ingredients BEGIN
 INSERT INTO ingredients_fts(ingredients_fts,rowid,name, category, aliases) VALUES('delete',old.rowid,old.name, old.category, old.aliases); END;
CREATE TRIGGER ingredients_fts_update AFTER UPDATE ON ingredients BEGIN
 INSERT INTO ingredients_fts(ingredients_fts,rowid,name, category, aliases) VALUES('delete',old.rowid,old.name, old.category, old.aliases);
 INSERT INTO ingredients_fts(rowid,name, category, aliases) VALUES(new.rowid,new.name, new.category, new.aliases); END;

CREATE VIRTUAL TABLE foods_fts USING fts5(name, brand, category, content='foods', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER foods_fts_insert AFTER INSERT ON foods BEGIN
 INSERT INTO foods_fts(rowid,name, brand, category) VALUES(new.rowid,new.name, new.brand, new.category); END;
CREATE TRIGGER foods_fts_delete AFTER DELETE ON foods BEGIN
 INSERT INTO foods_fts(foods_fts,rowid,name, brand, category) VALUES('delete',old.rowid,old.name, old.brand, old.category); END;
CREATE TRIGGER foods_fts_update AFTER UPDATE ON foods BEGIN
 INSERT INTO foods_fts(foods_fts,rowid,name, brand, category) VALUES('delete',old.rowid,old.name, old.brand, old.category);
 INSERT INTO foods_fts(rowid,name, brand, category) VALUES(new.rowid,new.name, new.brand, new.category); END;

CREATE VIRTUAL TABLE recipe_catalog_fts USING fts5(name, description, cuisine, tags, content='recipe_catalog', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER recipe_catalog_fts_insert AFTER INSERT ON recipe_catalog BEGIN
 INSERT INTO recipe_catalog_fts(rowid,name, description, cuisine, tags) VALUES(new.rowid,new.name, new.description, new.cuisine, new.tags); END;
CREATE TRIGGER recipe_catalog_fts_delete AFTER DELETE ON recipe_catalog BEGIN
 INSERT INTO recipe_catalog_fts(recipe_catalog_fts,rowid,name, description, cuisine, tags) VALUES('delete',old.rowid,old.name, old.description, old.cuisine, old.tags); END;
CREATE TRIGGER recipe_catalog_fts_update AFTER UPDATE ON recipe_catalog BEGIN
 INSERT INTO recipe_catalog_fts(recipe_catalog_fts,rowid,name, description, cuisine, tags) VALUES('delete',old.rowid,old.name, old.description, old.cuisine, old.tags);
 INSERT INTO recipe_catalog_fts(rowid,name, description, cuisine, tags) VALUES(new.rowid,new.name, new.description, new.cuisine, new.tags); END;

CREATE VIRTUAL TABLE techniques_fts USING fts5(title, summary, category, tags, content='techniques', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER techniques_fts_insert AFTER INSERT ON techniques BEGIN
 INSERT INTO techniques_fts(rowid,title, summary, category, tags) VALUES(new.rowid,new.title, new.summary, new.category, new.tags); END;
CREATE TRIGGER techniques_fts_delete AFTER DELETE ON techniques BEGIN
 INSERT INTO techniques_fts(techniques_fts,rowid,title, summary, category, tags) VALUES('delete',old.rowid,old.title, old.summary, old.category, old.tags); END;
CREATE TRIGGER techniques_fts_update AFTER UPDATE ON techniques BEGIN
 INSERT INTO techniques_fts(techniques_fts,rowid,title, summary, category, tags) VALUES('delete',old.rowid,old.title, old.summary, old.category, old.tags);
 INSERT INTO techniques_fts(rowid,title, summary, category, tags) VALUES(new.rowid,new.title, new.summary, new.category, new.tags); END;
