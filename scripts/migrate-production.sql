-- Production Migration Script for Guessometer
-- This script safely migrates from Replit Auth schema to email/password schema

-- Step 1: Add display_name column if it doesn't exist (allow NULL initially)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar;

-- Step 2: Add password column if it doesn't exist (for email auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password varchar;

-- Step 3: Add provider column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider varchar DEFAULT 'email';

-- Step 4: Migrate existing users' names to display_name
UPDATE users 
SET display_name = COALESCE(
  display_name,  -- Keep existing display_name if present
  TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), -- Combine first + last
  email  -- Fallback to email if no names
)
WHERE display_name IS NULL OR display_name = '';

-- Step 5: Make display_name NOT NULL after data migration
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

-- Step 6: Make email NOT NULL if it isn't already  
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Step 7: Add unique constraint to email if it doesn't exist
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_email_unique UNIQUE (email);

-- Now the schema is ready for the new structure
-- After this runs successfully, you can drop the old columns:
-- ALTER TABLE users DROP COLUMN IF EXISTS first_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS email_verified;