-- ============================================================================
-- Seed the public recipe_catalog with a starter set of real recipes. Additive +
-- idempotent (on conflict slug do nothing). Ingredients are jsonb arrays of
-- { name, quantity, unit } matching the app's Recipe type. Nutrition per serving.
-- ============================================================================

insert into public.recipe_catalog
  (slug, name, description, cuisine, minutes, difficulty, servings, equipment,
   ingredients, steps, tags, calories, protein_g, carbs_g, fat_g)
values
  ('garlic-butter-rice','Garlic Butter Rice',
   'Fluffy rice tossed with toasted garlic and butter — the easy side that goes with everything.',
   'American',20,'easy',4,'{saucepan}',
   '[{"name":"rice","quantity":1.5,"unit":"cup"},{"name":"butter","quantity":2,"unit":"tbsp"},{"name":"garlic","quantity":3,"unit":"pcs"},{"name":"salt","quantity":1,"unit":"tsp"}]'::jsonb,
   '{"Rinse the rice until the water runs clear.","Melt butter in a saucepan and gently toast minced garlic until golden.","Add rice and 3 cups water, bring to a boil, then cover and simmer 15 minutes.","Rest 5 minutes off heat, fluff with a fork, and season with salt."}',
   '{side,quick,vegetarian}',320,6,52,9),

  ('simple-tomato-pasta','Simple Tomato Pasta',
   'A weeknight classic — pasta in a quick garlicky tomato sauce.',
   'Italian',25,'easy',2,'{pot,pan}',
   '[{"name":"pasta","quantity":200,"unit":"g"},{"name":"canned tomatoes","quantity":1,"unit":"pcs"},{"name":"garlic","quantity":2,"unit":"pcs"},{"name":"olive oil","quantity":2,"unit":"tbsp"},{"name":"onion","quantity":1,"unit":"pcs"}]'::jsonb,
   '{"Boil the pasta in salted water until al dente.","Soften diced onion and garlic in olive oil.","Add the tomatoes, simmer 10 minutes, and season.","Toss the drained pasta through the sauce and serve."}',
   '{dinner,vegetarian,pasta}',520,16,82,12),

  ('chickpea-curry','Chickpea Curry',
   'A cosy, fragrant chickpea curry that comes together from pantry staples.',
   'Indian',35,'medium',4,'{pot}',
   '[{"name":"chickpeas","quantity":2,"unit":"cup"},{"name":"canned tomatoes","quantity":1,"unit":"pcs"},{"name":"onion","quantity":1,"unit":"pcs"},{"name":"garlic","quantity":3,"unit":"pcs"},{"name":"ginger","quantity":1,"unit":"tbsp"},{"name":"cumin","quantity":1,"unit":"tsp"},{"name":"coconut milk","quantity":1,"unit":"cup"}]'::jsonb,
   '{"Saute onion, garlic, and ginger until soft.","Toast the cumin until fragrant.","Add tomatoes and chickpeas; simmer 15 minutes.","Stir in coconut milk and simmer 5 more minutes. Serve with rice."}',
   '{dinner,vegan,curry}',410,15,48,18),

  ('veggie-stir-fry','Veggie Stir-fry',
   'Crisp-tender vegetables in a glossy soy-garlic sauce — faster than takeout.',
   'Chinese',20,'easy',2,'{wok}',
   '[{"name":"broccoli","quantity":2,"unit":"cup"},{"name":"carrot","quantity":1,"unit":"pcs"},{"name":"bell pepper","quantity":1,"unit":"pcs"},{"name":"soy sauce","quantity":3,"unit":"tbsp"},{"name":"garlic","quantity":2,"unit":"pcs"},{"name":"sesame oil","quantity":1,"unit":"tbsp"}]'::jsonb,
   '{"Heat the wok until smoking and add sesame oil.","Stir-fry garlic, then the firmest vegetables first.","Add the rest and toss over high heat 3-4 minutes.","Add soy sauce, toss to glaze, and serve over rice."}',
   '{dinner,vegan,quick}',230,8,24,11),

  ('banana-oat-pancakes','Banana Oat Pancakes',
   'Naturally sweet, fluffy pancakes from oats and ripe bananas.',
   'American',20,'easy',2,'{blender,pan}',
   '[{"name":"oats","quantity":1,"unit":"cup"},{"name":"banana","quantity":2,"unit":"pcs"},{"name":"egg","quantity":2,"unit":"pcs"},{"name":"milk","quantity":0.5,"unit":"cup"},{"name":"cinnamon","quantity":0.5,"unit":"tsp"}]'::jsonb,
   '{"Blend oats, bananas, eggs, milk, and cinnamon into a smooth batter.","Rest the batter 5 minutes to thicken.","Cook spoonfuls on a greased pan until bubbles form, then flip.","Serve warm with fruit or a drizzle of honey."}',
   '{breakfast,vegetarian}',360,15,52,9),

  ('lemon-garlic-salmon','Lemon Garlic Salmon',
   'Roast salmon with lemon and garlic — bright, fast, and weeknight-friendly.',
   'American',25,'easy',2,'{oven,baking tray}',
   '[{"name":"salmon","quantity":2,"unit":"pcs"},{"name":"lemon","quantity":1,"unit":"pcs"},{"name":"garlic","quantity":2,"unit":"pcs"},{"name":"olive oil","quantity":1,"unit":"tbsp"},{"name":"black pepper","quantity":0.5,"unit":"tsp"}]'::jsonb,
   '{"Heat the oven to 200C / 400F.","Rub salmon with olive oil, minced garlic, pepper, and lemon zest.","Roast 12-15 minutes until just opaque.","Finish with a squeeze of lemon."}',
   '{dinner,protein,quick}',380,34,4,25)
on conflict (slug) do nothing;
