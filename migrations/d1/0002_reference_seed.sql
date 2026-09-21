-- Public reference data only. Converted from the committed PostgreSQL seed files.
-- Deterministic UUIDv5 IDs: URL namespace + https://pantry.ainadara.com/catalog/<table>/<slug>.
-- Arrays are JSON; escape-string guide bodies preserve newlines. Nutrition values
-- are unchanged (ingredients per 100 g, catalog recipe values per serving).
-- USDA ingredient figures are public domain; guide/recipe source remains curated.
-- Public source: 20260601000001_food_consortium.sql

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('f73228a4-c139-540c-9795-bc220b57221a','olive-oil','Olive oil','Oils & Condiments','["oil"]',NULL,884,0,0,100,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('217c6234-1063-53cf-99dc-46f7a6efb746','butter','Butter','Dairy & Eggs','[]',NULL,717,0.9,0.1,81,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('64fbbe10-0746-5784-a239-d67618354c26','egg','Egg','Dairy & Eggs','["eggs"]',50,155,13,1.1,11,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('4e47260d-182a-539f-84b1-46598d174a67','chicken-breast','Chicken breast','Meat & Seafood','["chicken"]',NULL,165,31,0,3.6,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('e0ccd094-f8b3-5343-a395-09c96d20f027','ground-beef','Ground beef','Meat & Seafood','["beef","mince"]',NULL,254,26,0,17,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('d1730913-24d2-583f-b30a-65f2456c2b23','salmon','Salmon','Meat & Seafood','[]',NULL,208,20,0,13,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('4c690910-f871-5a29-9b59-62c40c95af89','shrimp','Shrimp','Meat & Seafood','["prawns"]',NULL,99,24,0.2,0.3,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('648bc53f-9b05-5268-9f09-cb509af89df1','rice','Rice','Grains & Bread','["white rice"]',NULL,130,2.7,28,0.3,0.4) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('02e94089-6eb6-5160-975f-d9ce979adb2f','pasta','Pasta','Grains & Bread','["spaghetti","noodles"]',NULL,158,5.8,31,0.9,1.8) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('63cc1725-db47-5160-b7b2-1153d89913a3','bread','Bread','Grains & Bread','[]',NULL,265,9,49,3.2,2.7) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('14b2c573-8383-5b88-a52f-a69848e2bf02','flour','Flour','Grains & Bread','["all-purpose flour"]',NULL,364,10,76,1,2.7) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('4e789868-2a96-5c13-ba00-859a980aa4ce','milk','Milk','Dairy & Eggs','["whole milk"]',NULL,60,3.2,4.6,3.3,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('94ce0797-57e3-501b-92a9-5413f4d1b574','greek-yogurt','Greek yogurt','Dairy & Eggs','["yogurt"]',NULL,59,10,3.6,0.4,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('6724e212-a8d6-57a2-9fe1-fd0c5122930a','cheddar','Cheddar','Dairy & Eggs','["cheese"]',NULL,403,25,1.3,33,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('fb52c3e6-e2af-55c4-b08f-f71331943512','tomato','Tomato','Produce','["tomatoes"]',120,18,0.9,3.9,0.2,1.2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('3eb44cc1-2f79-5c11-a325-b22f5d88269f','onion','Onion','Produce','["onions"]',110,40,1.1,9,0.1,1.7) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('e7fd6497-bccd-58dc-b348-584608fd47f5','garlic','Garlic','Produce','[]',3,149,6.4,33,0.5,2.1) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('c4473598-e66a-5019-9638-555b0681692c','potato','Potato','Produce','["potatoes"]',150,77,2,17,0.1,2.2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('bfb0fad2-ccea-5192-8e94-80db3bcaee58','carrot','Carrot','Produce','["carrots"]',60,41,0.9,10,0.2,2.8) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('297d7700-2bac-5e2e-93da-49025ff28159','spinach','Spinach','Produce','[]',NULL,23,2.9,3.6,0.4,2.2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('d0b6739c-f1d0-57c8-9a54-1ed8c08df016','bell-pepper','Bell pepper','Produce','["pepper","capsicum"]',150,31,1,6,0.3,2.1) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('53fd4dc0-5b4a-5bd1-8dc8-03989089ce04','banana','Banana','Produce','["bananas"]',120,89,1.1,23,0.3,2.6) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('0846e2b9-472c-557f-9590-da04300c4f82','lemon','Lemon','Produce','["lemons"]',60,29,1.1,9,0.3,2.8) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('c2c18c7a-ff1a-513a-aac4-b7ee874c383c','black-beans','Black beans','Legumes & Nuts','["beans"]',NULL,132,8.9,24,0.5,8.7) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('1a1273b2-8f77-5004-bf5e-7c3ea8804da9','chickpeas','Chickpeas','Legumes & Nuts','["garbanzo beans"]',NULL,164,8.9,27,2.6,7.6) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('6a0779e7-71fe-5a9c-b2b5-66cba3114ccb','lentils','Lentils','Legumes & Nuts','[]',NULL,116,9,20,0.4,7.9) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('3a8c88da-0833-5dd3-bbe3-caf414e21248','almonds','Almonds','Legumes & Nuts','[]',NULL,579,21,22,50,12) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('5a34464a-682c-5e81-a8a4-9a6cc9097e47','peanut-butter','Peanut butter','Legumes & Nuts','[]',NULL,588,25,20,50,6) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('263a7600-8c19-5ca9-b884-e88e478adc2e','soy-sauce','Soy sauce','Oils & Condiments','[]',NULL,53,8,4.9,0.6,0.8) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('af3aad61-1509-55e5-acd4-986a4759f431','honey','Honey','Pantry & Spices','[]',NULL,304,0.3,82,0,0.2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('8ee44305-2485-598f-bcf7-87ebad7b4902','sugar','Sugar','Pantry & Spices','[]',NULL,387,0,100,0,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('15c1bd72-f761-519c-9252-6f87e8585b15','salt','Salt','Pantry & Spices','[]',NULL,0,0,0,0,0) on conflict (slug) do nothing;

-- Public source: 20260601000001_food_consortium.sql

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,tags) VALUES ('2f86b01e-86cc-5bdc-917d-b935dcd1a8c3','blanching','Blanching','Vegetables','easy',10,'Briefly boil vegetables, then plunge into ice water to set colour and stop cooking.','["vegetables","prep","boil"]') on conflict (slug) do nothing;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,tags) VALUES ('2447ff90-249f-54df-ad2e-7774e82489ce','searing','Searing','Heat & Protein','medium',15,'Brown protein in a very hot pan to build deep flavour via the Maillard reaction.','["protein","heat","maillard"]') on conflict (slug) do nothing;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,tags) VALUES ('99a51d63-9673-58a3-9d89-4771864393b5','julienne','Julienne cut','Knife Skills','medium',10,'Cut vegetables into thin, even matchsticks for fast, uniform cooking.','["knife","prep","cuts"]') on conflict (slug) do nothing;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,tags) VALUES ('9a7ece82-3c1e-59f7-addf-b09c30f3bf69','steaming','Steaming','Vegetables','easy',15,'Cook over simmering water with gentle moist heat that preserves nutrients and colour.','["vegetables","moist-heat","healthy"]') on conflict (slug) do nothing;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,tags) VALUES ('8a1eff55-2c63-5d13-b640-55a4085500f2','caramelizing-onions','Caramelizing onions','Aromatics','easy',40,'Cook sliced onions low and slow until deeply golden and sweet.','["aromatics","low-and-slow"]') on conflict (slug) do nothing;

-- Public source: 20260601000003_expand_consortium.sql

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('c224ce28-507d-5c51-a3dd-ceedc7c84864','cucumber','Cucumber','Produce','["cucumbers"]',300,15,0.7,3.6,0.1,0.5) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('a38b8516-2463-5df7-b15d-51683746f8ef','broccoli','Broccoli','Produce','[]',NULL,34,2.8,7,0.4,2.6) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('67804045-d301-5e55-a7db-36a948b6bf9d','cauliflower','Cauliflower','Produce','[]',NULL,25,1.9,5,0.3,2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('4d4a05ac-017c-50d9-b2ca-55d088a482e1','zucchini','Zucchini','Produce','["courgette"]',196,17,1.2,3.1,0.3,1) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('913c3913-dc20-53fd-9ce7-699fe1299bdd','mushroom','Mushroom','Produce','["mushrooms"]',NULL,22,3.1,3.3,0.3,1) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('4ed4b61f-afcd-5e76-a9ec-259fa188ffa5','avocado','Avocado','Produce','["avocados"]',200,160,2,9,15,7) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('80eb12d1-cb12-5780-9703-667936bbba9d','apple','Apple','Produce','["apples"]',182,52,0.3,14,0.2,2.4) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('2674391b-1fde-54d8-a120-2ccc2ef128d1','orange','Orange','Produce','["oranges"]',131,47,0.9,12,0.1,2.4) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('068f1c79-d216-5d15-adc5-8412bb484754','strawberry','Strawberry','Produce','["strawberries"]',NULL,32,0.7,7.7,0.3,2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('0be7423c-fabb-5580-9be0-0740476157aa','blueberry','Blueberry','Produce','["blueberries"]',NULL,57,0.7,14,0.3,2.4) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('a94a16c1-d9d6-5682-a148-f3e634e5c8ec','ginger','Ginger','Produce','[]',NULL,80,1.8,18,0.8,2) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('6f59156b-1f37-5457-a6ac-d27923c4962d','cilantro','Cilantro','Produce','["coriander"]',NULL,23,2.1,3.7,0.5,2.8) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('f8c65284-208a-5ace-a9e2-d93e759c77c6','kale','Kale','Produce','[]',NULL,49,4.3,9,0.9,3.6) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('d507cd4d-0dd8-560f-b43b-b4499f132d7c','sweet-potato','Sweet potato','Produce','["sweet potatoes","yam"]',130,86,1.6,20,0.1,3) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('674bf89e-64ee-52b6-a7e7-592f52732c40','pork','Pork','Meat & Seafood','["pork chop"]',NULL,242,27,0,14,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('22524e87-88d7-5e04-a852-3e5fa273914d','turkey','Turkey','Meat & Seafood','[]',NULL,135,29,0,1,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('aea73316-e8a5-5225-878b-9729009b4855','tuna','Tuna','Meat & Seafood','[]',NULL,132,28,0,1,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('e7c895fa-6bee-5905-91e2-4547205045f0','cod','Cod','Meat & Seafood','[]',NULL,82,18,0,0.7,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('c079d960-1ae9-56f4-b209-a117f9a92381','tofu','Tofu','Legumes & Nuts','["bean curd"]',NULL,76,8,1.9,4.8,0.3) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('36db5c2e-a3a1-53d6-ba80-a07539f9632e','oats','Oats','Grains & Bread','["oatmeal","rolled oats"]',NULL,389,17,66,7,11) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('31be8335-a32c-590f-91a5-ddab1125e13f','quinoa','Quinoa','Grains & Bread','[]',NULL,120,4.4,21,1.9,2.8) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('1fe60b8c-6ab1-5dd3-a5e0-11f32b68a0dd','couscous','Couscous','Grains & Bread','[]',NULL,112,3.8,23,0.2,1.4) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('fbe7e7aa-b4aa-5b42-ad8e-a08c8106f730','tortilla','Tortilla','Grains & Bread','["tortillas"]',NULL,310,8,52,7,3) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('df60930b-0dfc-5e17-a069-46d03e28eec6','mozzarella','Mozzarella','Dairy & Eggs','[]',NULL,280,28,3.1,17,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('d45d31bd-973e-5df5-825e-1f99932e5529','parmesan','Parmesan','Dairy & Eggs','["parmigiano"]',NULL,392,36,3.2,29,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('2e03bba1-ba05-5f8f-9f63-804b2e83eefa','kidney-beans','Kidney beans','Legumes & Nuts','[]',NULL,127,8.7,23,0.5,6.4) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('0a151a70-dd6c-53d8-a929-31a8dab16d2d','walnuts','Walnuts','Legumes & Nuts','[]',NULL,654,15,14,65,6.7) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('0999e4bf-e23d-5e84-a4cf-d0305d95bd41','cashews','Cashews','Legumes & Nuts','[]',NULL,553,18,30,44,3.3) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('ece8c3c2-122e-5aa7-a434-a8a429efa3b8','black-pepper','Black pepper','Pantry & Spices','["pepper"]',NULL,251,10,64,3.3,25) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('eeea89e2-1203-5d17-ba9a-0a66fa9cef82','cumin','Cumin','Pantry & Spices','[]',NULL,375,18,44,22,11) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('8cff03b4-870a-5093-9350-1dd599195e3a','paprika','Paprika','Pantry & Spices','[]',NULL,282,14,54,13,35) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('8d7745b8-9eed-57ad-843e-54161ca4c62c','cinnamon','Cinnamon','Pantry & Spices','[]',NULL,247,4,81,1.2,53) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('1bd2826b-0b9d-5b96-8b73-394ad6f6a279','chili-powder','Chili powder','Pantry & Spices','[]',NULL,282,13,50,14,35) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('785fc56a-df4e-5ca0-8070-f9b8d2fbc98b','cocoa-powder','Cocoa powder','Pantry & Spices','["cocoa"]',NULL,228,20,58,14,37) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('c7260af5-c5f9-5436-99ba-62807ff574d0','vanilla-extract','Vanilla extract','Pantry & Spices','["vanilla"]',NULL,288,0.1,13,0.1,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('975c31f9-5064-518f-a55d-b7dcdf9fa0f8','vegetable-oil','Vegetable oil','Oils & Condiments','["canola oil"]',NULL,884,0,0,100,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('6746069a-5187-5f14-bebd-d00572c13b68','sesame-oil','Sesame oil','Oils & Condiments','[]',NULL,884,0,0,100,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('54e24359-6c4b-590b-8d02-7c1a249a53a3','vinegar','Vinegar','Oils & Condiments','[]',NULL,18,0,0.9,0,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('23f32331-b4c6-5642-b944-3ef9c2d617d4','ketchup','Ketchup','Oils & Condiments','[]',NULL,101,1,27,0.1,0.3) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('0e5050ed-c900-55dd-91a5-e124db9ebd01','mustard','Mustard','Oils & Condiments','[]',NULL,66,4,5,4,3) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('f7f346b5-8875-5159-9681-d1b5f5b5a8b3','mayonnaise','Mayonnaise','Oils & Condiments','["mayo"]',NULL,680,1,0.6,75,0) on conflict (slug) do nothing;

INSERT INTO ingredients(id,slug,name,category,aliases,grams_per_piece,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES ('b512a7ae-a57e-5ff6-b117-eec4f7170417','coconut-milk','Coconut milk','Dairy & Eggs','[]',NULL,230,2.3,6,24,2.2) on conflict (slug) do nothing;

-- Public source: 20260601000003_expand_consortium.sql

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('2f86b01e-86cc-5bdc-917d-b935dcd1a8c3','blanching','Blanching','Vegetables','easy',10,'Briefly boil vegetables, then plunge into ice water to set colour and stop cooking.','1. Bring a large pot of salted water to a rolling boil and prepare a bowl of ice water.' || char(10) || '2. Drop in the vegetables and cook 30 seconds to 3 minutes depending on size.' || char(10) || '3. Lift them straight into the ice bath to halt cooking and lock in colour.' || char(10) || '4. Drain well. Great for prepping greens, beans, and tomatoes (the skins slip off).','["vegetables","prep","boil"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('2447ff90-249f-54df-ad2e-7774e82489ce','searing','Searing','Heat & Protein','medium',15,'Brown protein in a very hot pan to build deep flavour via the Maillard reaction.','1. Pat the protein bone-dry and season.' || char(10) || '2. Heat a heavy pan until just smoking, add a thin film of high-smoke-point oil.' || char(10) || '3. Lay the food away from you and **do not move it** for 2-4 minutes — it releases when a crust forms.' || char(10) || '4. Flip once, finish, then rest. A fond (browned bits) is left behind for a pan sauce.','["protein","heat","maillard"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('99a51d63-9673-58a3-9d89-4771864393b5','julienne','Julienne cut','Knife Skills','medium',10,'Cut vegetables into thin, even matchsticks for fast, uniform cooking.','1. Square off the vegetable so it sits flat.' || char(10) || '2. Slice into thin planks (~3mm).' || char(10) || '3. Stack a few planks and slice again into matchsticks.' || char(10) || '4. Keep your guiding knuckles forward and the blade tip on the board. Evenness matters more than speed.','["knife","prep","cuts"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('9a7ece82-3c1e-59f7-addf-b09c30f3bf69','steaming','Steaming','Vegetables','easy',15,'Cook over simmering water with gentle moist heat that preserves nutrients and colour.','1. Bring an inch of water to a simmer under a steamer basket.' || char(10) || '2. Add vegetables in a single layer, cover, and steam until just tender.' || char(10) || '3. Check early — most greens need only 3-5 minutes.' || char(10) || '4. Season after, since steaming adds no salt of its own.','["vegetables","moist-heat","healthy"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('8a1eff55-2c63-5d13-b640-55a4085500f2','caramelizing-onions','Caramelizing onions','Aromatics','easy',40,'Cook sliced onions low and slow until deeply golden and sweet.','1. Thinly slice onions and add to a wide pan with a little oil or butter over medium-low.' || char(10) || '2. Stir occasionally; let them go truly golden-brown, not just soft — 30-45 minutes.' || char(10) || '3. Deglaze with a splash of water if they stick.' || char(10) || '4. A pinch of salt early draws out moisture and speeds things along.','["aromatics","low-and-slow"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('c54c3203-abcc-504a-a253-de7ec1d4ff5d','roasting','Roasting','Heat & Protein','easy',45,'Dry oven heat that browns the outside while cooking the inside through.','1. Heat the oven to 200-220C / 400-425F.' || char(10) || '2. Toss food with oil and salt; spread in a single layer so it roasts rather than steams.' || char(10) || '3. Give it room — a crowded tray traps moisture.' || char(10) || '4. Flip once halfway for even colour.','["oven","vegetables","protein"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('3c991d64-79e2-5a01-b3ed-ef2bc9d69fad','sauteing','Sauteing','Heat & Protein','easy',10,'Quick-cook small pieces in a little fat over fairly high heat, keeping them moving.','1. Heat a wide pan and a little oil until shimmering.' || char(10) || '2. Add food in a single layer and toss or stir frequently.' || char(10) || '3. Keep the heat lively so things brown instead of stewing.' || char(10) || '4. Work in batches if the pan looks crowded.','["heat","quick","stovetop"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('b4aef716-5e38-52b2-b82c-b2781bc347b8','braising','Braising','Heat & Protein','medium',120,'Sear, then slow-cook in a little liquid until tender. Best for tough cuts.','1. Brown the meat hard on all sides, then remove.' || char(10) || '2. Soften aromatics in the same pot.' || char(10) || '3. Add liquid to come halfway up the meat, return it, cover, and cook low (oven or stovetop) until fork-tender.' || char(10) || '4. The collagen melts into the sauce — patience is the technique.','["low-and-slow","braise","comfort"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('91c36fa7-2922-5036-9afd-ae1c4798b57c','deglazing','Deglazing','Sauces','easy',5,'Lift the browned fond from a pan with liquid to build an instant sauce.','1. After searing, pour off excess fat, leaving the browned bits.' || char(10) || '2. Off heat, add a splash of stock, wine, or water.' || char(10) || '3. Scrape the bottom with a wooden spoon as it bubbles.' || char(10) || '4. Reduce, then finish with a knob of butter for shine.','["sauce","fond","quick"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('2b37c07a-c266-571d-a47c-d9ad1f7ff06f','mise-en-place','Mise en place','Prep','easy',15,'Prep and arrange every ingredient before the heat goes on.','Translating to "everything in its place," this is the habit that makes cooking calm. Measure, chop, and bowl up each component, and read the recipe through, **before** you start cooking. Fast recipes especially leave no time to chop mid-stream.','["prep","organization","foundations"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('673c6f08-8445-5ccb-8e7b-40d30fc243f9','resting-meat','Resting meat','Heat & Protein','easy',10,'Let cooked meat sit before slicing so juices redistribute.','1. Pull meat from the heat a few degrees before target — it keeps rising (carryover).' || char(10) || '2. Tent loosely with foil and wait: 5 minutes for steaks, 15-20 for roasts.' || char(10) || '3. Slice against the grain for tenderness.','["protein","rest","technique"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('9bf7f06f-c0a3-5574-9323-043d5710eb84','toasting-spices','Toasting spices','Aromatics','easy',5,'Dry-toast whole or ground spices briefly to wake up their aroma.','1. Warm a dry pan over medium heat.' || char(10) || '2. Add spices and shake constantly until fragrant — 30-90 seconds.' || char(10) || '3. Tip out immediately so they do not scorch.' || char(10) || '4. Grind whole spices after toasting for the biggest flavour gain.','["spices","aromatics","flavour"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('d33b8931-8ce0-50cf-a2c9-ccb0284b1690','making-a-roux','Making a roux','Sauces','medium',10,'Cook equal parts fat and flour as the base for a smooth sauce or gravy.','1. Melt butter, whisk in an equal weight of flour.' || char(10) || '2. Cook, whisking, from blond (1-2 min) to brown depending on the dish.' || char(10) || '3. Add liquid gradually, whisking out lumps each time.' || char(10) || '4. Simmer to thicken and cook off the raw-flour taste.','["sauce","thickening","foundations"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('662c02aa-4f1f-51ef-ba02-e2e40457227d','poaching','Poaching','Heat & Protein','medium',15,'Cook gently in barely-simmering liquid for tender, delicate results.','1. Bring liquid (water, stock, milk) to 70-80C / 160-180F — just trembling, no rolling boil.' || char(10) || '2. Slip in eggs, fish, or chicken.' || char(10) || '3. Hold the gentle heat until just set.' || char(10) || '4. Season the poaching liquid well; it flavours from the outside in.','["gentle","moist-heat","delicate"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

INSERT INTO techniques(id,slug,title,category,difficulty,minutes,summary,body,tags) VALUES ('baf8f12c-361e-5126-9535-5fb3622b489e','grilling','Grilling','Heat & Protein','medium',20,'Cook over direct high heat for char and smoke.','1. Get the grill properly hot and oil the grates.' || char(10) || '2. Set up two zones — hot for searing, cooler to finish thicker pieces.' || char(10) || '3. Let a crust form before turning so food releases cleanly.' || char(10) || '4. Rest grilled meats before serving.','["grill","char","outdoor"]') on conflict (slug) do update set
  summary = excluded.summary,
  body = excluded.body,
  minutes = excluded.minutes,
  category = excluded.category,
  tags = excluded.tags;

-- Public source: 20260601000004_seed_recipe_catalog.sql

INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,calories,protein_g,carbs_g,fat_g) VALUES ('e66345de-928f-5efb-b8e0-66f63f532734','garlic-butter-rice','Garlic Butter Rice','Fluffy rice tossed with toasted garlic and butter — the easy side that goes with everything.','American',20,'easy',4,'["saucepan"]','[{"name":"rice","quantity":1.5,"unit":"cup"},{"name":"butter","quantity":2,"unit":"tbsp"},{"name":"garlic","quantity":3,"unit":"pcs"},{"name":"salt","quantity":1,"unit":"tsp"}]','["Rinse the rice until the water runs clear.","Melt butter in a saucepan and gently toast minced garlic until golden.","Add rice and 3 cups water, bring to a boil, then cover and simmer 15 minutes.","Rest 5 minutes off heat, fluff with a fork, and season with salt."]','["side","quick","vegetarian"]',320,6,52,9) on conflict (slug) do nothing;

INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,calories,protein_g,carbs_g,fat_g) VALUES ('70f92cec-f13f-5804-9483-24a0886b7ec6','simple-tomato-pasta','Simple Tomato Pasta','A weeknight classic — pasta in a quick garlicky tomato sauce.','Italian',25,'easy',2,'["pot","pan"]','[{"name":"pasta","quantity":200,"unit":"g"},{"name":"canned tomatoes","quantity":1,"unit":"pcs"},{"name":"garlic","quantity":2,"unit":"pcs"},{"name":"olive oil","quantity":2,"unit":"tbsp"},{"name":"onion","quantity":1,"unit":"pcs"}]','["Boil the pasta in salted water until al dente.","Soften diced onion and garlic in olive oil.","Add the tomatoes, simmer 10 minutes, and season.","Toss the drained pasta through the sauce and serve."]','["dinner","vegetarian","pasta"]',520,16,82,12) on conflict (slug) do nothing;

INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,calories,protein_g,carbs_g,fat_g) VALUES ('0818e70d-7833-5228-b785-1d7140b67d58','chickpea-curry','Chickpea Curry','A cosy, fragrant chickpea curry that comes together from pantry staples.','Indian',35,'medium',4,'["pot"]','[{"name":"chickpeas","quantity":2,"unit":"cup"},{"name":"canned tomatoes","quantity":1,"unit":"pcs"},{"name":"onion","quantity":1,"unit":"pcs"},{"name":"garlic","quantity":3,"unit":"pcs"},{"name":"ginger","quantity":1,"unit":"tbsp"},{"name":"cumin","quantity":1,"unit":"tsp"},{"name":"coconut milk","quantity":1,"unit":"cup"}]','["Saute onion, garlic, and ginger until soft.","Toast the cumin until fragrant.","Add tomatoes and chickpeas; simmer 15 minutes.","Stir in coconut milk and simmer 5 more minutes. Serve with rice."]','["dinner","vegan","curry"]',410,15,48,18) on conflict (slug) do nothing;

INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,calories,protein_g,carbs_g,fat_g) VALUES ('1f812dcf-daf3-5dd7-b7e2-51512ccd102c','veggie-stir-fry','Veggie Stir-fry','Crisp-tender vegetables in a glossy soy-garlic sauce — faster than takeout.','Chinese',20,'easy',2,'["wok"]','[{"name":"broccoli","quantity":2,"unit":"cup"},{"name":"carrot","quantity":1,"unit":"pcs"},{"name":"bell pepper","quantity":1,"unit":"pcs"},{"name":"soy sauce","quantity":3,"unit":"tbsp"},{"name":"garlic","quantity":2,"unit":"pcs"},{"name":"sesame oil","quantity":1,"unit":"tbsp"}]','["Heat the wok until smoking and add sesame oil.","Stir-fry garlic, then the firmest vegetables first.","Add the rest and toss over high heat 3-4 minutes.","Add soy sauce, toss to glaze, and serve over rice."]','["dinner","vegan","quick"]',230,8,24,11) on conflict (slug) do nothing;

INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,calories,protein_g,carbs_g,fat_g) VALUES ('0a967e2e-ed37-5e47-b9cd-b7ff5cac66cb','banana-oat-pancakes','Banana Oat Pancakes','Naturally sweet, fluffy pancakes from oats and ripe bananas.','American',20,'easy',2,'["blender","pan"]','[{"name":"oats","quantity":1,"unit":"cup"},{"name":"banana","quantity":2,"unit":"pcs"},{"name":"egg","quantity":2,"unit":"pcs"},{"name":"milk","quantity":0.5,"unit":"cup"},{"name":"cinnamon","quantity":0.5,"unit":"tsp"}]','["Blend oats, bananas, eggs, milk, and cinnamon into a smooth batter.","Rest the batter 5 minutes to thicken.","Cook spoonfuls on a greased pan until bubbles form, then flip.","Serve warm with fruit or a drizzle of honey."]','["breakfast","vegetarian"]',360,15,52,9) on conflict (slug) do nothing;

INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,calories,protein_g,carbs_g,fat_g) VALUES ('89301ed9-9514-56fd-abf8-afbcf853060b','lemon-garlic-salmon','Lemon Garlic Salmon','Roast salmon with lemon and garlic — bright, fast, and weeknight-friendly.','American',25,'easy',2,'["oven","baking tray"]','[{"name":"salmon","quantity":2,"unit":"pcs"},{"name":"lemon","quantity":1,"unit":"pcs"},{"name":"garlic","quantity":2,"unit":"pcs"},{"name":"olive oil","quantity":1,"unit":"tbsp"},{"name":"black pepper","quantity":0.5,"unit":"tsp"}]','["Heat the oven to 200C / 400F.","Rub salmon with olive oil, minced garlic, pepper, and lemon zest.","Roast 12-15 minutes until just opaque.","Finish with a squeeze of lemon."]','["dinner","protein","quick"]',380,34,4,25) on conflict (slug) do nothing;
