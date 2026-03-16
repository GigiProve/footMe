-- Add agent and director values to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'agent';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'director';

-- Add auth_provider column to profiles (nullable for backward compatibility)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_provider text
    CHECK (auth_provider IN ('google', 'apple', 'email'));
