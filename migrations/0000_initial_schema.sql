-- Current schema baseline (tables already exist, this is a no-op migration)
-- This migration represents the current state of the database

-- Categories table (already exists)
-- CREATE TABLE "categories" (
--     "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
--     "airtable_id" varchar,
--     "name" varchar NOT NULL,
--     "color" varchar,
--     "created_at" timestamp DEFAULT now(),
--     CONSTRAINT "categories_airtable_id_unique" UNIQUE("airtable_id")
-- );

-- No-op statement to make this a valid migration file
SELECT 1;